import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";

const secretsClient = new SecretsManagerClient({});
const bedrockClient = new BedrockRuntimeClient({});

// Cache
let supabaseCredentials: { url: string; service_role_key: string } | null = null;
let encryptionKey: string | null = null;
let whatsappCredentials: { phone_number_id: string; access_token: string } | null = null;

interface EmailAccount {
  id: string;
  tenant_id: string;
  email_address: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  is_active: boolean;
  last_sync_at: string | null;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; attachmentId?: string };
      filename?: string;
    }>;
  };
  internalDate: string;
}

async function getSecrets() {
  if (!supabaseCredentials) {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.SUPABASE_SECRET_ARN })
    );
    supabaseCredentials = JSON.parse(response.SecretString || "{}");
  }

  if (!encryptionKey) {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.ENCRYPTION_KEY_SECRET_ARN })
    );
    const parsed = JSON.parse(response.SecretString || "{}");
    encryptionKey = parsed.key;
  }

  if (!whatsappCredentials) {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.WHATSAPP_SECRET_ARN })
    );
    whatsappCredentials = JSON.parse(response.SecretString || "{}");
  }

  return { supabaseCredentials, encryptionKey, whatsappCredentials };
}

function decryptToken(encryptedData: string, key: string): string {
  const keyBuffer = Buffer.from(key.slice(0, 64), "hex");
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

async function refreshAccessToken(
  refreshToken: string,
  supabase: SupabaseClient,
  accountId: string
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID!,
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }

  const tokens = await response.json();

  // Update token in database (would need to re-encrypt, simplified here)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await supabase
    .from("email_accounts")
    .update({ token_expires_at: expiresAt.toISOString() })
    .eq("id", accountId);

  return tokens.access_token;
}

async function listGmailMessages(
  accessToken: string,
  query: string = "is:unread newer_than:1d",
  maxResults: number = 20
): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list messages: ${await response.text()}`);
  }

  const data = await response.json();
  return data.messages || [];
}

async function getGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get message: ${await response.text()}`);
  }

  return response.json();
}

function extractHeader(message: GmailMessage, headerName: string): string {
  return (
    message.payload.headers.find(
      (h) => h.name.toLowerCase() === headerName.toLowerCase()
    )?.value || ""
  );
}

function decodeBase64(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function getEmailBody(message: GmailMessage): string {
  // Try to get text/plain part first
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data).slice(0, 2000); // Limit for LLM
      }
    }
    // Fall back to HTML
    for (const part of message.payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64(part.body.data);
        // Basic HTML stripping
        return html.replace(/<[^>]*>/g, " ").slice(0, 2000);
      }
    }
  }

  // Simple message body
  if (message.payload.body?.data) {
    return decodeBase64(message.payload.body.data).slice(0, 2000);
  }

  return message.snippet || "";
}

async function classifyEmailImportance(
  subject: string,
  from: string,
  body: string
): Promise<{ isImportant: boolean; summary: string; category: string }> {
  const prompt = `You are classifying emails for a roofing contractor. Analyze this email and respond with JSON only.

Email:
From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 1500)}

Respond with JSON:
{
  "isImportant": boolean (true if: customer inquiry, urgent job issue, payment received, permit update, insurance claim, supplier issue),
  "summary": "1-2 sentence summary",
  "category": "customer|supplier|permit|insurance|payment|marketing|other"
}`;

  try {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Classification error:", error);
  }

  // Default fallback
  return {
    isImportant: false,
    summary: subject,
    category: "other",
  };
}

async function sendWhatsAppNotification(
  phoneNumber: string,
  emailSummary: string,
  from: string,
  credentials: { phone_number_id: string; access_token: string }
) {
  const message = `📧 Important Email\nFrom: ${from}\n\n${emailSummary}\n\nReply "email" to hear more.`;

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${credentials.phone_number_id}/messages`,
    {
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
    }
  );

  if (!response.ok) {
    console.error("WhatsApp notification failed:", await response.text());
  }
}

export async function handler() {
  console.log("Gmail poller starting...");

  const { supabaseCredentials: supabase, encryptionKey: key, whatsappCredentials: whatsapp } =
    await getSecrets();

  if (!supabase || !key) {
    console.error("Missing secrets");
    return { statusCode: 500, body: "Configuration error" };
  }

  const supabaseClient = createClient(supabase.url, supabase.service_role_key);

  // Get all active email accounts
  const { data: accounts, error } = await supabaseClient
    .from("email_accounts")
    .select("*, tenants(whatsapp_business_number), users!inner(phone_number, role)")
    .eq("is_active", true)
    .eq("provider", "gmail");

  if (error) {
    console.error("Error fetching accounts:", error);
    return { statusCode: 500, body: "Database error" };
  }

  console.log(`Processing ${accounts?.length || 0} email accounts`);

  for (const account of accounts || []) {
    try {
      console.log(`Processing account: ${account.email_address}`);

      // Decrypt tokens
      let accessToken: string;
      const refreshToken = decryptToken(account.refresh_token_encrypted, key);

      // Check if token is expired
      const tokenExpiry = new Date(account.token_expires_at);
      if (tokenExpiry < new Date()) {
        console.log("Token expired, refreshing...");
        accessToken = await refreshAccessToken(refreshToken, supabaseClient, account.id);
      } else {
        accessToken = decryptToken(account.access_token_encrypted, key);
      }

      // Build query - get unread emails since last sync
      let query = "is:unread";
      if (account.last_sync_at) {
        const lastSync = new Date(account.last_sync_at);
        const afterDate = Math.floor(lastSync.getTime() / 1000);
        query += ` after:${afterDate}`;
      } else {
        query += " newer_than:1d";
      }

      // List messages
      const messageList = await listGmailMessages(accessToken, query, 20);
      console.log(`Found ${messageList.length} new messages`);

      let importantCount = 0;

      for (const msgRef of messageList) {
        // Check if we already processed this email
        const { data: existing } = await supabaseClient
          .from("emails")
          .select("id")
          .eq("email_account_id", account.id)
          .eq("provider_message_id", msgRef.id)
          .single();

        if (existing) {
          continue; // Already processed
        }

        // Get full message
        const message = await getGmailMessage(accessToken, msgRef.id);
        const subject = extractHeader(message, "Subject");
        const from = extractHeader(message, "From");
        const body = getEmailBody(message);
        const hasAttachments = message.payload.parts?.some(
          (p) => p.filename && p.filename.length > 0
        );

        // Classify importance
        const classification = await classifyEmailImportance(subject, from, body);

        // Store in database
        await supabaseClient.from("emails").insert({
          tenant_id: account.tenant_id,
          email_account_id: account.id,
          provider_message_id: msgRef.id,
          subject,
          from_address: from,
          body_text: body,
          summary: classification.summary,
          is_important: classification.isImportant,
          has_attachments: hasAttachments,
          received_at: new Date(parseInt(message.internalDate)).toISOString(),
        });

        // Send WhatsApp notification for important emails
        if (classification.isImportant && whatsapp) {
          // Find manager to notify
          const { data: manager } = await supabaseClient
            .from("users")
            .select("phone_number")
            .eq("tenant_id", account.tenant_id)
            .in("role", ["manager", "owner"])
            .limit(1)
            .single();

          if (manager?.phone_number) {
            await sendWhatsAppNotification(
              manager.phone_number,
              classification.summary,
              from,
              whatsapp
            );
            importantCount++;
          }
        }
      }

      // Update last sync time
      await supabaseClient
        .from("email_accounts")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", account.id);

      console.log(
        `Account ${account.email_address}: ${messageList.length} processed, ${importantCount} important`
      );
    } catch (error) {
      console.error(`Error processing account ${account.email_address}:`, error);

      // Mark account as inactive if auth fails
      if (error instanceof Error && error.message.includes("Token refresh failed")) {
        await supabaseClient
          .from("email_accounts")
          .update({ is_active: false })
          .eq("id", account.id);
      }
    }
  }

  return { statusCode: 200, body: "OK" };
}
