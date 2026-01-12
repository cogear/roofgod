import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const secretsClient = new SecretsManagerClient({});
const s3Client = new S3Client({});

// Cache for secrets
let supabaseCredentials: { url: string; service_role_key: string } | null = null;
let supabaseClient: SupabaseClient | null = null;

// Bedrock Agent action group event structure
interface AgentActionEvent {
  messageVersion: string;
  agent: {
    name: string;
    id: string;
    alias: string;
    version: string;
  };
  inputText: string;
  sessionId: string;
  actionGroup: string;
  apiPath: string;
  httpMethod: string;
  parameters: Array<{ name: string; type: string; value: string }>;
  requestBody?: {
    content: {
      "application/json": {
        properties: Array<{ name: string; type: string; value: string }>;
      };
    };
  };
  sessionAttributes: Record<string, string>;
  promptSessionAttributes: Record<string, string>;
}

interface AgentActionResponse {
  messageVersion: string;
  response: {
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    httpStatusCode: number;
    responseBody: {
      "application/json": {
        body: string;
      };
    };
  };
}

async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseClient) return supabaseClient;

  if (!supabaseCredentials) {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.SUPABASE_SECRET_ARN })
    );
    supabaseCredentials = JSON.parse(response.SecretString || "{}");
  }

  supabaseClient = createClient(
    supabaseCredentials!.url,
    supabaseCredentials!.service_role_key
  );

  return supabaseClient;
}

function getParameter(
  event: AgentActionEvent,
  name: string
): string | undefined {
  // Check URL parameters
  const param = event.parameters?.find((p) => p.name === name);
  if (param) return param.value;

  // Check request body
  const bodyProp = event.requestBody?.content?.["application/json"]?.properties?.find(
    (p) => p.name === name
  );
  if (bodyProp) return bodyProp.value;

  return undefined;
}

function getUserContext(event: AgentActionEvent): {
  tenantId?: string;
  userId?: string;
  userRole?: string;
} {
  try {
    const contextStr = event.sessionAttributes?.userContext;
    if (contextStr) {
      const context = JSON.parse(contextStr);
      return {
        tenantId: context.tenant_id,
        userId: context.user_id,
        userRole: context.user_role,
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return {};
}

function createResponse(
  event: AgentActionEvent,
  statusCode: number,
  body: unknown
): AgentActionResponse {
  return {
    messageVersion: "1.0",
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: statusCode,
      responseBody: {
        "application/json": {
          body: JSON.stringify(body),
        },
      },
    },
  };
}

// ========================================
// PROJECT MANAGEMENT ACTIONS
// ========================================

async function createProject(event: AgentActionEvent): Promise<AgentActionResponse> {
  const supabase = await getSupabase();
  const { tenantId } = getUserContext(event);

  if (!tenantId) {
    return createResponse(event, 400, {
      error: "No tenant context. Please complete onboarding first.",
    });
  }

  const name = getParameter(event, "name");
  const address = getParameter(event, "address");
  const customerName = getParameter(event, "customer_name");
  const customerPhone = getParameter(event, "customer_phone");
  const notes = getParameter(event, "notes");

  if (!name) {
    return createResponse(event, 400, { error: "Project name is required" });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      tenant_id: tenantId,
      name,
      address,
      customer_name: customerName,
      customer_phone: customerPhone,
      notes,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    return createResponse(event, 500, { error: "Failed to create project" });
  }

  return createResponse(event, 200, {
    message: `Project "${name}" created successfully`,
    project_id: data.id,
    project: data,
  });
}

async function getProject(event: AgentActionEvent): Promise<AgentActionResponse> {
  const supabase = await getSupabase();
  const { tenantId } = getUserContext(event);

  if (!tenantId) {
    return createResponse(event, 400, { error: "No tenant context" });
  }

  const projectId = getParameter(event, "project_id");
  const name = getParameter(event, "name");

  let query = supabase
    .from("projects")
    .select("*, project_members(*, users(name, phone_number, role))")
    .eq("tenant_id", tenantId);

  if (projectId) {
    query = query.eq("id", projectId);
  } else if (name) {
    query = query.ilike("name", `%${name}%`);
  } else {
    return createResponse(event, 400, {
      error: "Either project_id or name is required",
    });
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) {
    return createResponse(event, 404, { error: "Project not found" });
  }

  return createResponse(event, 200, { project: data });
}

async function listProjects(event: AgentActionEvent): Promise<AgentActionResponse> {
  const supabase = await getSupabase();
  const { tenantId } = getUserContext(event);

  if (!tenantId) {
    return createResponse(event, 400, { error: "No tenant context" });
  }

  const status = getParameter(event, "status");
  const limit = parseInt(getParameter(event, "limit") || "10");

  let query = supabase
    .from("projects")
    .select("id, name, address, status, customer_name, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error listing projects:", error);
    return createResponse(event, 500, { error: "Failed to list projects" });
  }

  return createResponse(event, 200, {
    projects: data,
    count: data?.length || 0,
  });
}

async function assignCrewMember(event: AgentActionEvent): Promise<AgentActionResponse> {
  const supabase = await getSupabase();
  const { tenantId } = getUserContext(event);

  if (!tenantId) {
    return createResponse(event, 400, { error: "No tenant context" });
  }

  const projectId = getParameter(event, "project_id");
  const projectName = getParameter(event, "project_name");
  const phoneNumber = getParameter(event, "phone_number");
  const name = getParameter(event, "name");
  const role = getParameter(event, "role") || "crew";

  if (!phoneNumber) {
    return createResponse(event, 400, { error: "Phone number is required" });
  }

  // Find or create project
  let targetProjectId = projectId;
  if (!targetProjectId && projectName) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${projectName}%`)
      .limit(1)
      .single();

    if (project) {
      targetProjectId = project.id;
    } else {
      return createResponse(event, 404, {
        error: `Project "${projectName}" not found`,
      });
    }
  }

  if (!targetProjectId) {
    return createResponse(event, 400, {
      error: "Either project_id or project_name is required",
    });
  }

  // Find or create user
  let { data: user } = await supabase
    .from("users")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("phone_number", phoneNumber)
    .single();

  if (!user) {
    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        tenant_id: tenantId,
        phone_number: phoneNumber,
        name: name || `Crew ${phoneNumber.slice(-4)}`,
        role: role,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating user:", createError);
      return createResponse(event, 500, { error: "Failed to create crew member" });
    }

    user = newUser;
  }

  // Assign to project
  const { error: assignError } = await supabase.from("project_members").upsert({
    project_id: targetProjectId,
    user_id: user.id,
    role: role,
  });

  if (assignError) {
    console.error("Error assigning crew:", assignError);
    return createResponse(event, 500, { error: "Failed to assign crew member" });
  }

  return createResponse(event, 200, {
    message: `${user.name || phoneNumber} has been assigned to the project`,
    user_id: user.id,
    project_id: targetProjectId,
    is_new_user: !user,
  });
}

// ========================================
// DOCUMENT MANAGEMENT ACTIONS
// ========================================

async function searchDocuments(event: AgentActionEvent): Promise<AgentActionResponse> {
  const supabase = await getSupabase();
  const { tenantId } = getUserContext(event);

  if (!tenantId) {
    return createResponse(event, 400, { error: "No tenant context" });
  }

  const query = getParameter(event, "query");
  const projectName = getParameter(event, "project_name");
  const documentType = getParameter(event, "document_type");
  const limit = parseInt(getParameter(event, "limit") || "10");

  let dbQuery = supabase
    .from("documents")
    .select("id, filename, document_type, created_at, metadata, projects(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (documentType) {
    dbQuery = dbQuery.eq("document_type", documentType);
  }

  if (projectName) {
    // Join with projects to filter by name
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${projectName}%`);

    if (projects && projects.length > 0) {
      dbQuery = dbQuery.in(
        "project_id",
        projects.map((p) => p.id)
      );
    }
  }

  if (query) {
    // Search in filename and extracted text
    dbQuery = dbQuery.or(`filename.ilike.%${query}%,extracted_text.ilike.%${query}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("Error searching documents:", error);
    return createResponse(event, 500, { error: "Failed to search documents" });
  }

  return createResponse(event, 200, {
    documents: data,
    count: data?.length || 0,
  });
}

async function storeDocument(event: AgentActionEvent): Promise<AgentActionResponse> {
  const supabase = await getSupabase();
  const { tenantId } = getUserContext(event);

  if (!tenantId) {
    return createResponse(event, 400, { error: "No tenant context" });
  }

  const filename = getParameter(event, "filename");
  const documentType = getParameter(event, "document_type");
  const projectId = getParameter(event, "project_id");
  const projectName = getParameter(event, "project_name");
  const content = getParameter(event, "content"); // Base64 encoded
  const extractedText = getParameter(event, "extracted_text");

  if (!filename) {
    return createResponse(event, 400, { error: "Filename is required" });
  }

  // Find project if name provided
  let targetProjectId = projectId;
  if (!targetProjectId && projectName) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${projectName}%`)
      .limit(1)
      .single();

    if (project) {
      targetProjectId = project.id;
    }
  }

  // Generate S3 key
  const timestamp = Date.now();
  const s3Key = targetProjectId
    ? `${tenantId}/projects/${targetProjectId}/${documentType || "general"}/${timestamp}-${filename}`
    : `${tenantId}/general/${documentType || "unclassified"}/${timestamp}-${filename}`;

  // Upload to S3 if content provided
  if (content) {
    const buffer = Buffer.from(content, "base64");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.DOCUMENTS_BUCKET,
        Key: s3Key,
        Body: buffer,
      })
    );
  }

  // Store metadata in Supabase
  const { data, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      project_id: targetProjectId,
      filename,
      document_type: documentType,
      s3_key: s3Key,
      s3_bucket: process.env.DOCUMENTS_BUCKET,
      extracted_text: extractedText,
      source: "agent",
    })
    .select()
    .single();

  if (error) {
    console.error("Error storing document:", error);
    return createResponse(event, 500, { error: "Failed to store document" });
  }

  return createResponse(event, 200, {
    message: `Document "${filename}" stored successfully`,
    document_id: data.id,
    s3_key: s3Key,
  });
}

// ========================================
// MAIN HANDLER
// ========================================

export async function handler(event: AgentActionEvent): Promise<AgentActionResponse> {
  console.log("Agent action event:", JSON.stringify(event, null, 2));

  const actionGroup = event.actionGroup;
  const apiPath = event.apiPath;

  try {
    // Route to appropriate handler based on action group and path
    if (actionGroup === "ProjectManagement") {
      switch (apiPath) {
        case "/createProject":
          return await createProject(event);
        case "/getProject":
          return await getProject(event);
        case "/listProjects":
          return await listProjects(event);
        case "/assignCrewMember":
          return await assignCrewMember(event);
        default:
          return createResponse(event, 404, {
            error: `Unknown API path: ${apiPath}`,
          });
      }
    }

    if (actionGroup === "DocumentManagement") {
      switch (apiPath) {
        case "/searchDocuments":
          return await searchDocuments(event);
        case "/storeDocument":
          return await storeDocument(event);
        default:
          return createResponse(event, 404, {
            error: `Unknown API path: ${apiPath}`,
          });
      }
    }

    return createResponse(event, 404, {
      error: `Unknown action group: ${actionGroup}`,
    });
  } catch (error) {
    console.error("Handler error:", error);
    return createResponse(event, 500, {
      error: "Internal server error",
    });
  }
}
