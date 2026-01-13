import { ScheduledEvent } from "aws-lambda";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const secretsClient = new SecretsManagerClient({});
const bedrockClient = new BedrockRuntimeClient({});

// Cache
let supabaseCredentials: { url: string; service_role_key: string } | null = null;
let whatsappCredentials: { phone_number_id: string; access_token: string } | null = null;

interface TenantSummary {
  tenantId: string;
  tenantName: string;
  timezone: string;
  activeProjects: number;
  projectsStartingToday: Array<{ name: string; address: string }>;
  unreadEmails: number;
  importantEmails: Array<{ subject: string; from: string }>;
  documentsProcessedYesterday: number;
  pendingInvitations: number;
  managers: Array<{ id: string; name: string; phoneNumber: string }>;
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

async function getTenantSummary(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantSummary | null> {
  // Get tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, timezone, settings")
    .eq("id", tenantId)
    .single();

  if (!tenant) return null;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Get managers
  const { data: managers } = await supabase
    .from("users")
    .select("id, name, phone_number")
    .eq("tenant_id", tenantId)
    .in("role", ["manager", "owner"])
    .eq("is_active", true);

  if (!managers || managers.length === 0) return null;

  // Get active projects count
  const { count: activeProjects } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  // Get projects starting today
  const { data: projectsStartingToday } = await supabase
    .from("projects")
    .select("name, address")
    .eq("tenant_id", tenantId)
    .eq("start_date", today);

  // Get unread/important emails from yesterday
  const { data: importantEmails, count: unreadEmails } = await supabase
    .from("emails")
    .select("subject, from_address", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_important", true)
    .gte("received_at", yesterday)
    .limit(5);

  // Get documents processed yesterday
  const { count: documentsProcessedYesterday } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", yesterday)
    .lt("created_at", today);

  // Get pending invitations
  const { count: pendingInvitations } = await supabase
    .from("pending_invitations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    timezone: tenant.timezone || "America/New_York",
    activeProjects: activeProjects || 0,
    projectsStartingToday: projectsStartingToday || [],
    unreadEmails: unreadEmails || 0,
    importantEmails: (importantEmails || []).map((e) => ({
      subject: e.subject || "No subject",
      from: e.from_address || "Unknown",
    })),
    documentsProcessedYesterday: documentsProcessedYesterday || 0,
    pendingInvitations: pendingInvitations || 0,
    managers: managers.map((m) => ({
      id: m.id,
      name: m.name || "Manager",
      phoneNumber: m.phone_number,
    })),
  };
}

async function generateHuddleMessage(summary: TenantSummary): Promise<string> {
  const prompt = `Generate a brief, friendly morning huddle message for a roofing contractor manager. Keep it SHORT (under 300 characters) and actionable.

Data for today:
- Company: ${summary.tenantName}
- Active projects: ${summary.activeProjects}
- Projects starting today: ${summary.projectsStartingToday.map((p) => p.name).join(", ") || "None"}
- Important emails to review: ${summary.unreadEmails}
- Documents processed yesterday: ${summary.documentsProcessedYesterday}
- Pending crew invitations: ${summary.pendingInvitations}

Write a concise morning summary. Use simple language. No hashtags. No emojis except one at the start.`;

  try {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text.trim();
  } catch (error) {
    console.error("Error generating huddle message:", error);

    // Fallback message
    let message = `Good morning! Here's your daily huddle:\n`;
    message += `- ${summary.activeProjects} active projects\n`;
    if (summary.projectsStartingToday.length > 0) {
      message += `- Starting today: ${summary.projectsStartingToday[0].name}\n`;
    }
    if (summary.unreadEmails > 0) {
      message += `- ${summary.unreadEmails} emails need attention\n`;
    }
    message += `Have a great day!`;
    return message;
  }
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  credentials: { phone_number_id: string; access_token: string }
) {
  const url = `https://graph.facebook.com/v21.0/${credentials.phone_number_id}/messages`;

  try {
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
      console.error(`Failed to send to ${phoneNumber}:`, error);
      return false;
    }

    console.log(`Sent huddle to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`Error sending to ${phoneNumber}:`, error);
    return false;
  }
}

function shouldSendHuddle(timezone: string): boolean {
  // Get current hour in the tenant's timezone
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    const currentHour = parseInt(formatter.format(now), 10);

    // Send huddle between 7 AM and 8 AM in tenant's timezone
    return currentHour === 7;
  } catch (error) {
    console.error(`Invalid timezone ${timezone}, skipping`);
    return false;
  }
}

export async function handler(event: ScheduledEvent) {
  console.log("Daily huddle starting...", JSON.stringify(event, null, 2));

  const { supabaseCredentials: supabase, whatsappCredentials: whatsapp } =
    await getSecrets();

  if (!supabase || !whatsapp) {
    console.error("Missing credentials");
    return { statusCode: 500, body: "Configuration error" };
  }

  const supabaseClient = createClient(supabase.url, supabase.service_role_key);

  // Get all active tenants
  const { data: tenants } = await supabaseClient
    .from("tenants")
    .select("id, timezone, settings")
    .eq("subscription_status", "active")
    .or("subscription_status.eq.trialing");

  if (!tenants || tenants.length === 0) {
    console.log("No active tenants found");
    return { statusCode: 200, body: "No tenants to process" };
  }

  let sentCount = 0;
  let skippedCount = 0;

  for (const tenant of tenants) {
    const timezone = tenant.timezone || "America/New_York";

    // Check if huddle is enabled in settings
    const settings = tenant.settings || {};
    if (settings.daily_huddle_disabled) {
      console.log(`Huddle disabled for tenant ${tenant.id}`);
      skippedCount++;
      continue;
    }

    // Check if it's the right time for this tenant
    if (!shouldSendHuddle(timezone)) {
      console.log(`Not huddle time for tenant ${tenant.id} (${timezone})`);
      skippedCount++;
      continue;
    }

    try {
      const summary = await getTenantSummary(supabaseClient, tenant.id);

      if (!summary) {
        console.log(`No summary available for tenant ${tenant.id}`);
        continue;
      }

      const message = await generateHuddleMessage(summary);

      // Send to all managers
      for (const manager of summary.managers) {
        const sent = await sendWhatsAppMessage(
          manager.phoneNumber,
          message,
          whatsapp
        );
        if (sent) sentCount++;
      }

      // Log the huddle
      await supabaseClient.from("messages").insert({
        tenant_id: tenant.id,
        direction: "outbound",
        message_type: "text",
        content: message,
        agent_model: "daily-huddle",
      });

      // Track usage
      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      await supabaseClient.rpc("increment_usage", {
        p_tenant_id: tenant.id,
        p_month: currentMonth,
        p_whatsapp_sent: summary.managers.length,
      });
    } catch (error) {
      console.error(`Error processing tenant ${tenant.id}:`, error);
    }
  }

  console.log(`Daily huddle complete. Sent: ${sentCount}, Skipped: ${skippedCount}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ sent: sentCount, skipped: skippedCount }),
  };
}
