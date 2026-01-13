"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Dashboard Stats
export async function getDashboardStats() {
  const supabase = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00.000Z`;

  const [
    tenantsResult,
    usersResult,
    messagesTodayResult,
    documentsResult,
    activeProjectsResult,
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay),
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  return {
    totalTenants: tenantsResult.count || 0,
    totalUsers: usersResult.count || 0,
    messagesToday: messagesTodayResult.count || 0,
    totalDocuments: documentsResult.count || 0,
    activeProjects: activeProjectsResult.count || 0,
  };
}

// Tenants
export async function getTenants() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(`
      *,
      users:users(count),
      projects:projects(count)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tenants:", error);
    return [];
  }

  return data || [];
}

export async function getTenantById(id: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(`
      *,
      users(*),
      projects(*),
      email_accounts(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching tenant:", error);
    return null;
  }

  return data;
}

// Conversations
export async function getConversations(limit = 50) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      users(id, name, phone_number, role),
      tenants(id, name),
      projects:current_project_id(id, name)
    `)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }

  return data || [];
}

export async function getConversationById(id: string) {
  const supabase = createAdminClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select(`
      *,
      users(id, name, phone_number, role),
      tenants(id, name),
      projects:current_project_id(id, name, address)
    `)
    .eq("id", id)
    .single();

  if (convError) {
    console.error("Error fetching conversation:", convError);
    return null;
  }

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Error fetching messages:", msgError);
  }

  return {
    ...conversation,
    messages: messages || [],
  };
}

// Documents
export async function getDocuments(limit = 50, filters?: {
  tenantId?: string;
  projectId?: string;
  documentType?: string;
}) {
  const supabase = createAdminClient();

  let query = supabase
    .from("documents")
    .select(`
      *,
      tenants(id, name),
      projects(id, name, address)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }
  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }
  if (filters?.documentType) {
    query = query.eq("document_type", filters.documentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  return data || [];
}

export async function getDocumentById(id: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      tenants(id, name),
      projects(id, name, address)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching document:", error);
    return null;
  }

  return data;
}

// Usage & Analytics
export async function getUsageStats(tenantId?: string) {
  const supabase = createAdminClient();

  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 7) + "-01";

  let query = supabase
    .from("usage_tracking")
    .select("*")
    .gte("month", lastMonth)
    .order("month", { ascending: false });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching usage:", error);
    return [];
  }

  return data || [];
}

export async function getAggregatedUsage() {
  const supabase = createAdminClient();

  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

  const { data, error } = await supabase
    .from("usage_tracking")
    .select("*")
    .eq("month", currentMonth);

  if (error) {
    console.error("Error fetching aggregated usage:", error);
    return null;
  }

  // Aggregate across all tenants
  const totals = (data || []).reduce(
    (acc, row) => ({
      whatsappReceived: acc.whatsappReceived + (row.whatsapp_messages_received || 0),
      whatsappSent: acc.whatsappSent + (row.whatsapp_messages_sent || 0),
      documentsProcessed: acc.documentsProcessed + (row.documents_processed || 0),
      emailsProcessed: acc.emailsProcessed + (row.emails_processed || 0),
      bedrockInputTokens: acc.bedrockInputTokens + (row.bedrock_input_tokens || 0),
      bedrockOutputTokens: acc.bedrockOutputTokens + (row.bedrock_output_tokens || 0),
    }),
    {
      whatsappReceived: 0,
      whatsappSent: 0,
      documentsProcessed: 0,
      emailsProcessed: 0,
      bedrockInputTokens: 0,
      bedrockOutputTokens: 0,
    }
  );

  return {
    month: currentMonth,
    ...totals,
  };
}

// Recent Activity
export async function getRecentActivity(limit = 20) {
  const supabase = createAdminClient();

  // Get recent messages
  const { data: messages } = await supabase
    .from("messages")
    .select(`
      id, created_at, content, direction, message_type,
      conversations(users(name, phone_number), tenants(name))
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (messages || []).map((m) => ({
    id: m.id,
    type: "message" as const,
    timestamp: m.created_at,
    direction: m.direction,
    messageType: m.message_type,
    content: m.content?.substring(0, 100) + (m.content?.length > 100 ? "..." : ""),
    user: (m.conversations as any)?.users?.name || "Unknown",
    tenant: (m.conversations as any)?.tenants?.name || "Unknown",
  }));
}
