import { SNSEvent, Context } from "aws-lambda";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { createClient } from "@supabase/supabase-js";

const secretsClient = new SecretsManagerClient({});
const bedrockClient = new BedrockAgentRuntimeClient({});

// Cache for secrets
let supabaseCredentials: { url: string; service_role_key: string } | null = null;
let whatsappCredentials: { phone_number_id: string; access_token: string } | null = null;

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "video";
  text?: { body: string };
  image?: { id: string; mime_type: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; filename: string; mime_type: string };
}

interface WhatsAppWebhookPayload {
  entry: Array<{
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
}

async function getSecrets() {
  if (!supabaseCredentials) {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.SUPABASE_SECRET_ARN })
    );
    supabaseCredentials = JSON.parse(response.SecretString || "{}");
  }

  if (!whatsappCredentials) {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.WHATSAPP_SECRET_ARN })
    );
    whatsappCredentials = JSON.parse(response.SecretString || "{}");
  }

  return { supabaseCredentials, whatsappCredentials };
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  credentials: { phone_number_id: string; access_token: string }
) {
  const url = `https://graph.facebook.com/v21.0/${credentials.phone_number_id}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "text",
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to send WhatsApp message:", error);
    throw new Error(`WhatsApp API error: ${error}`);
  }

  return response.json();
}

async function invokeAgent(
  sessionId: string,
  inputText: string,
  userContext: Record<string, unknown>
): Promise<string> {
  const agentId = process.env.BEDROCK_AGENT_ID;
  const agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID;

  if (!agentId || agentId === "PLACEHOLDER") {
    // Fallback for development - direct Bedrock invoke
    return `[Agent not configured] You said: "${inputText}"`;
  }

  const command = new InvokeAgentCommand({
    agentId,
    agentAliasId,
    sessionId,
    inputText,
    sessionState: {
      sessionAttributes: {
        userContext: JSON.stringify(userContext),
      },
    },
  });

  const response = await bedrockClient.send(command);

  // Collect response chunks
  let fullResponse = "";
  if (response.completion) {
    for await (const event of response.completion) {
      if (event.chunk?.bytes) {
        fullResponse += new TextDecoder().decode(event.chunk.bytes);
      }
    }
  }

  return fullResponse || "I'm sorry, I couldn't process that request.";
}

export async function handler(event: SNSEvent, context: Context) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const { supabaseCredentials: supabase, whatsappCredentials: whatsapp } =
    await getSecrets();

  if (!supabase || !whatsapp) {
    console.error("Failed to retrieve secrets");
    return { statusCode: 500, body: "Configuration error" };
  }

  const supabaseClient = createClient(supabase.url, supabase.service_role_key);

  for (const record of event.Records) {
    try {
      const payload: WhatsAppWebhookPayload = JSON.parse(record.Sns.Message);

      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          // Skip if no messages
          if (!value.messages || value.messages.length === 0) {
            continue;
          }

          for (const message of value.messages) {
            const phoneNumber = message.from;
            const messageId = message.id;
            const timestamp = message.timestamp;

            console.log(`Processing message from ${phoneNumber}: ${messageId}`);

            // Get message content based on type
            let messageContent = "";
            let messageType = message.type;

            if (message.type === "text" && message.text) {
              messageContent = message.text.body;
            } else if (message.type === "image") {
              messageContent = "[Image received]";
            } else if (message.type === "audio") {
              messageContent = "[Audio received]";
            } else if (message.type === "document") {
              messageContent = `[Document received: ${message.document?.filename}]`;
            } else {
              messageContent = `[${message.type} message received]`;
            }

            // Look up user by phone number
            const { data: user } = await supabaseClient
              .from("users")
              .select("*, tenants(*)")
              .eq("phone_number", phoneNumber)
              .single();

            let tenantId: string | null = null;
            let userId: string | null = null;
            let userRole = "unknown";
            let userName = "Unknown User";

            if (user) {
              tenantId = user.tenant_id;
              userId = user.id;
              userRole = user.role;
              userName = user.name || "Unknown";
            } else {
              // New user - check if they have a pending onboarding
              console.log(`Unknown user: ${phoneNumber}`);
            }

            // Get or create conversation
            let conversationId: string;

            if (userId) {
              const { data: existingConversation } = await supabaseClient
                .from("conversations")
                .select("id")
                .eq("user_id", userId)
                .order("last_message_at", { ascending: false })
                .limit(1)
                .single();

              if (existingConversation) {
                conversationId = existingConversation.id;
              } else {
                const { data: newConversation } = await supabaseClient
                  .from("conversations")
                  .insert({
                    tenant_id: tenantId,
                    user_id: userId,
                    last_message_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                conversationId = newConversation?.id;
              }
            } else {
              // Create temporary conversation for unknown users
              const { data: tempConversation } = await supabaseClient
                .from("conversations")
                .insert({
                  last_message_at: new Date().toISOString(),
                  context: { phone_number: phoneNumber, is_new_user: true },
                })
                .select("id")
                .single();

              conversationId = tempConversation?.id;
            }

            // Store inbound message
            await supabaseClient.from("messages").insert({
              conversation_id: conversationId,
              tenant_id: tenantId,
              direction: "inbound",
              message_type: messageType,
              content: messageContent,
              whatsapp_message_id: messageId,
              created_at: new Date(parseInt(timestamp) * 1000).toISOString(),
            });

            // Update conversation last_message_at
            await supabaseClient
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", conversationId);

            // Invoke Bedrock Agent
            const startTime = Date.now();
            const userContext = {
              phone_number: phoneNumber,
              user_id: userId,
              user_name: userName,
              user_role: userRole,
              tenant_id: tenantId,
              is_new_user: !user,
            };

            let agentResponse: string;

            try {
              agentResponse = await invokeAgent(
                conversationId,
                messageContent,
                userContext
              );
            } catch (error) {
              console.error("Agent invocation error:", error);
              agentResponse =
                "I'm having trouble processing your request right now. Please try again in a moment.";
            }

            const processingTime = Date.now() - startTime;

            // Send response via WhatsApp
            await sendWhatsAppMessage(phoneNumber, agentResponse, whatsapp);

            // Store outbound message
            await supabaseClient.from("messages").insert({
              conversation_id: conversationId,
              tenant_id: tenantId,
              direction: "outbound",
              message_type: "text",
              content: agentResponse,
              processing_time_ms: processingTime,
              agent_model: "bedrock-agent",
            });

            // Update usage tracking
            if (tenantId) {
              const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
              await supabaseClient.rpc("increment_usage", {
                p_tenant_id: tenantId,
                p_month: currentMonth,
                p_whatsapp_received: 1,
                p_whatsapp_sent: 1,
              });
            }

            console.log(
              `Processed message in ${processingTime}ms for ${phoneNumber}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing record:", error);
      // Don't throw - we want to continue processing other records
    }
  }

  return { statusCode: 200, body: "OK" };
}
