import { SNSEvent, Context } from "aws-lambda";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";

const secretsClient = new SecretsManagerClient({});
const bedrockClient = new BedrockAgentRuntimeClient({});
const sqsClient = new SQSClient({});

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

async function queueDocumentForProcessing(params: {
  mediaId: string;
  mediaType: string;
  filename?: string;
  tenantId: string;
  userId?: string;
  projectId?: string;
  conversationId?: string;
  messageText?: string;
}) {
  const queueUrl = process.env.DOCUMENT_QUEUE_URL;
  if (!queueUrl) {
    console.log("Document queue not configured, skipping");
    return;
  }

  const message = {
    type: "whatsapp_media",
    media_id: params.mediaId,
    media_type: params.mediaType,
    filename: params.filename,
    tenant_id: params.tenantId,
    user_id: params.userId,
    project_id: params.projectId,
    conversation_id: params.conversationId,
    message_text: params.messageText,
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    })
  );

  console.log("Queued document for processing:", params.mediaId);
}

// Persona instructions based on user role
function getPersonaInstruction(userRole: string, isNewUser: boolean): string {
  if (isNewUser) {
    return `PERSONA: This is a NEW USER who hasn't been set up yet. Welcome them warmly, ask if they're a manager or crew member, and help them get connected to their company.`;
  }

  switch (userRole) {
    case "owner":
    case "manager":
      return `PERSONA: This user is a MANAGER/OWNER. Provide detailed, comprehensive responses. Include financial details, timelines, analytics when relevant. Offer proactive suggestions and insights. Be professional but personable.`;
    case "crew":
      return `PERSONA: This user is a CREW MEMBER. Keep responses BRIEF and actionable. No financial details unless explicitly asked. Focus on what they need to do NOW. Use simple, direct language. One-line responses when possible.`;
    default:
      return `PERSONA: User role is unknown. Ask clarifying questions to understand who they are and how to help them.`;
  }
}

async function invokeAgent(
  sessionId: string,
  inputText: string,
  userContext: Record<string, unknown>,
  projectContext?: Record<string, unknown> | null
): Promise<string> {
  const agentId = process.env.BEDROCK_AGENT_ID;
  const agentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID;

  if (!agentId || agentId === "PLACEHOLDER") {
    // Fallback for development - direct Bedrock invoke
    return `[Agent not configured] You said: "${inputText}"`;
  }

  // Build enhanced session attributes
  const personaInstruction = getPersonaInstruction(
    userContext.user_role as string,
    userContext.is_new_user as boolean
  );

  const sessionAttributes: Record<string, string> = {
    userContext: JSON.stringify(userContext),
    personaInstruction,
  };

  // Add project context if available
  if (projectContext) {
    sessionAttributes.currentProject = JSON.stringify(projectContext);
  }

  const command = new InvokeAgentCommand({
    agentId,
    agentAliasId,
    sessionId,
    inputText,
    sessionState: {
      sessionAttributes,
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
            let mediaToProcess: {
              mediaId: string;
              mediaType: string;
              filename?: string;
            } | null = null;

            if (message.type === "text" && message.text) {
              messageContent = message.text.body;
            } else if (message.type === "image" && message.image) {
              messageContent = "[Image received - processing...]";
              mediaToProcess = {
                mediaId: message.image.id,
                mediaType: message.image.mime_type,
              };
            } else if (message.type === "audio") {
              messageContent = "[Audio received]";
            } else if (message.type === "document" && message.document) {
              messageContent = `[Document received: ${message.document.filename} - processing...]`;
              mediaToProcess = {
                mediaId: message.document.id,
                mediaType: message.document.mime_type,
                filename: message.document.filename,
              };
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

            // Fetch current project context if conversation has one
            let projectContext: Record<string, unknown> | null = null;
            const { data: conversationData } = await supabaseClient
              .from("conversations")
              .select("current_project_id, context")
              .eq("id", conversationId)
              .single();

            if (conversationData?.current_project_id) {
              const { data: projectData } = await supabaseClient
                .from("projects")
                .select(`
                  id, name, address, customer_name, status, start_date, notes,
                  project_members(user_id, role, users(name, phone_number))
                `)
                .eq("id", conversationData.current_project_id)
                .single();

              if (projectData) {
                projectContext = {
                  project_id: projectData.id,
                  project_name: projectData.name,
                  address: projectData.address,
                  customer_name: projectData.customer_name,
                  status: projectData.status,
                  start_date: projectData.start_date,
                  crew_count: projectData.project_members?.length || 0,
                };
              }
            }

            // Invoke Bedrock Agent
            const startTime = Date.now();
            const userContext = {
              phone_number: phoneNumber,
              user_id: userId,
              user_name: userName,
              user_role: userRole,
              tenant_id: tenantId,
              is_new_user: !user,
              conversation_context: conversationData?.context || {},
            };

            let agentResponse: string;

            try {
              agentResponse = await invokeAgent(
                conversationId,
                messageContent,
                userContext,
                projectContext
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

            // Queue media for document processing
            if (mediaToProcess && tenantId) {
              await queueDocumentForProcessing({
                mediaId: mediaToProcess.mediaId,
                mediaType: mediaToProcess.mediaType,
                filename: mediaToProcess.filename,
                tenantId,
                userId: userId || undefined,
                projectId: projectContext?.project_id as string | undefined,
                conversationId,
                messageText: message.type === "text" ? messageContent : undefined,
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
