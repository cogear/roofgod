import { SQSEvent } from "aws-lambda";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const secretsClient = new SecretsManagerClient({});
const bedrockClient = new BedrockRuntimeClient({});
const s3Client = new S3Client({});

// Cache
let supabaseCredentials: { url: string; service_role_key: string } | null = null;
let whatsappCredentials: { phone_number_id: string; access_token: string } | null = null;

interface DocumentProcessingMessage {
  type: "whatsapp_media" | "s3_object";
  tenant_id: string;
  user_id?: string;
  project_id?: string;
  conversation_id?: string;
  // For WhatsApp media
  media_id?: string;
  media_type?: string;
  filename?: string;
  // For S3 objects
  s3_bucket?: string;
  s3_key?: string;
  // Optional context
  message_text?: string;
}

interface ExtractionResult {
  document_type: string;
  confidence: number;
  extracted_text: string;
  structured_data: {
    addresses?: string[];
    dates?: string[];
    amounts?: Array<{ value: number; currency: string; description?: string }>;
    names?: string[];
    phone_numbers?: string[];
    permit_number?: string;
    invoice_number?: string;
    policy_number?: string;
  };
  summary: string;
  suggested_project?: string;
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

async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ data: Buffer; mimeType: string }> {
  // First, get the media URL
  const urlResponse = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!urlResponse.ok) {
    throw new Error(`Failed to get media URL: ${await urlResponse.text()}`);
  }

  const { url, mime_type } = await urlResponse.json();

  // Download the actual media
  const mediaResponse = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaResponse.ok) {
    throw new Error(`Failed to download media: ${mediaResponse.status}`);
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer),
    mimeType: mime_type,
  };
}

async function downloadFromS3(
  bucket: string,
  key: string
): Promise<{ data: Buffer; mimeType: string }> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  const bodyContents = await response.Body?.transformToByteArray();
  if (!bodyContents) {
    throw new Error("Empty S3 object");
  }

  return {
    data: Buffer.from(bodyContents),
    mimeType: response.ContentType || "application/octet-stream",
  };
}

function getMediaType(mimeType: string): "image" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

async function analyzeWithClaudeVision(
  imageData: Buffer,
  mimeType: string,
  context?: string
): Promise<ExtractionResult> {
  const mediaType = mimeType.split("/")[0] === "image" ? mimeType : "image/png";
  const base64Data = imageData.toString("base64");

  const prompt = `You are analyzing a document for a roofing contractor's business management system.

Analyze this image and extract all relevant information.

${context ? `Context from user: "${context}"` : ""}

Respond with JSON only in this exact format:
{
  "document_type": "permit|invoice|receipt|photo|insurance_scope|change_order|contract|estimate|inspection_report|material_list|other",
  "confidence": 0.0-1.0,
  "extracted_text": "Full text content extracted from the document",
  "structured_data": {
    "addresses": ["Any addresses found"],
    "dates": ["Any dates found in ISO format YYYY-MM-DD"],
    "amounts": [{"value": 1234.56, "currency": "USD", "description": "what the amount is for"}],
    "names": ["Customer or company names"],
    "phone_numbers": ["Any phone numbers"],
    "permit_number": "if this is a permit",
    "invoice_number": "if this is an invoice",
    "policy_number": "if this is insurance related"
  },
  "summary": "1-2 sentence summary of what this document is",
  "suggested_project": "If an address is found, suggest using it as project name"
}`;

  try {
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
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
    console.error("Claude Vision error:", error);
  }

  // Fallback result
  return {
    document_type: "other",
    confidence: 0.5,
    extracted_text: "",
    structured_data: {},
    summary: "Unable to analyze document",
  };
}

async function analyzePdfWithClaude(
  pdfData: Buffer,
  context?: string
): Promise<ExtractionResult> {
  // For PDFs, we'll use text extraction prompt
  // Note: In production, you might want to convert PDF pages to images
  // For now, we'll send as a document and ask Claude to describe what it can see

  const base64Data = pdfData.toString("base64");

  const prompt = `You are analyzing a PDF document for a roofing contractor's business management system.

This is a PDF file (base64 encoded). Please analyze its contents.

${context ? `Context from user: "${context}"` : ""}

Respond with JSON only in this exact format:
{
  "document_type": "permit|invoice|receipt|photo|insurance_scope|change_order|contract|estimate|inspection_report|material_list|other",
  "confidence": 0.0-1.0,
  "extracted_text": "Full text content extracted from the document",
  "structured_data": {
    "addresses": ["Any addresses found"],
    "dates": ["Any dates found in ISO format YYYY-MM-DD"],
    "amounts": [{"value": 1234.56, "currency": "USD", "description": "what the amount is for"}],
    "names": ["Customer or company names"],
    "phone_numbers": ["Any phone numbers"],
    "permit_number": "if this is a permit",
    "invoice_number": "if this is an invoice",
    "policy_number": "if this is insurance related"
  },
  "summary": "1-2 sentence summary of what this document is",
  "suggested_project": "If an address is found, suggest using it as project name"
}`;

  try {
    // Use Claude 3 Sonnet with PDF support
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("PDF analysis error:", error);
  }

  return {
    document_type: "other",
    confidence: 0.5,
    extracted_text: "",
    structured_data: {},
    summary: "Unable to analyze PDF",
  };
}

async function findOrCreateProject(
  supabase: SupabaseClient,
  tenantId: string,
  suggestedName: string
): Promise<string | null> {
  if (!suggestedName) return null;

  // Try to find existing project by address
  const { data: existingProject } = await supabase
    .from("projects")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(`address.ilike.%${suggestedName}%,name.ilike.%${suggestedName}%`)
    .limit(1)
    .single();

  if (existingProject) {
    return existingProject.id;
  }

  return null;
}

async function sendWhatsAppConfirmation(
  phoneNumber: string,
  summary: string,
  documentType: string,
  projectName: string | null,
  credentials: { phone_number_id: string; access_token: string }
) {
  const projectInfo = projectName ? ` Filed to: ${projectName}` : " (Not linked to a project yet)";
  const message = `📄 Document processed!\n\nType: ${documentType}\n${summary}${projectInfo}`;

  await fetch(
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
}

export async function handler(event: SQSEvent) {
  console.log("Document processor starting...", JSON.stringify(event, null, 2));

  const { supabaseCredentials: supabase, whatsappCredentials: whatsapp } =
    await getSecrets();

  if (!supabase) {
    console.error("Missing Supabase credentials");
    return { statusCode: 500, body: "Configuration error" };
  }

  const supabaseClient = createClient(supabase.url, supabase.service_role_key);

  for (const record of event.Records) {
    try {
      const message: DocumentProcessingMessage = JSON.parse(record.body);
      console.log("Processing document:", message);

      let mediaData: Buffer;
      let mimeType: string;
      let filename: string;

      // Download the document
      if (message.type === "whatsapp_media" && message.media_id && whatsapp) {
        const media = await downloadWhatsAppMedia(message.media_id, whatsapp.access_token);
        mediaData = media.data;
        mimeType = media.mimeType;
        filename = message.filename || `whatsapp-${message.media_id}`;
      } else if (message.type === "s3_object" && message.s3_bucket && message.s3_key) {
        const media = await downloadFromS3(message.s3_bucket, message.s3_key);
        mediaData = media.data;
        mimeType = media.mimeType;
        filename = message.s3_key.split("/").pop() || "document";
      } else {
        console.error("Invalid message type or missing data");
        continue;
      }

      // Analyze the document
      let result: ExtractionResult;

      if (mimeType === "application/pdf") {
        result = await analyzePdfWithClaude(mediaData, message.message_text);
      } else if (mimeType.startsWith("image/")) {
        result = await analyzeWithClaudeVision(mediaData, mimeType, message.message_text);
      } else {
        console.log("Unsupported mime type:", mimeType);
        result = {
          document_type: "other",
          confidence: 0,
          extracted_text: "",
          structured_data: {},
          summary: "Unsupported file type",
        };
      }

      console.log("Analysis result:", result);

      // Determine project
      let projectId = message.project_id;
      let projectName: string | null = null;

      if (!projectId && result.suggested_project) {
        projectId = await findOrCreateProject(
          supabaseClient,
          message.tenant_id,
          result.suggested_project
        );
      }

      if (projectId) {
        const { data: project } = await supabaseClient
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .single();
        projectName = project?.name || null;
      }

      // Generate S3 key
      const timestamp = Date.now();
      const docType = result.document_type || "general";
      const s3Key = projectId
        ? `${message.tenant_id}/projects/${projectId}/${docType}/${timestamp}-${filename}`
        : `${message.tenant_id}/general/${docType}/${timestamp}-${filename}`;

      // Upload to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.DOCUMENTS_BUCKET,
          Key: s3Key,
          Body: mediaData,
          ContentType: mimeType,
          Metadata: {
            "document-type": result.document_type,
            "tenant-id": message.tenant_id,
            ...(projectId && { "project-id": projectId }),
          },
        })
      );

      // Store in Supabase
      const { data: doc, error } = await supabaseClient
        .from("documents")
        .insert({
          tenant_id: message.tenant_id,
          project_id: projectId,
          document_type: result.document_type,
          filename,
          s3_key: s3Key,
          s3_bucket: process.env.DOCUMENTS_BUCKET,
          extracted_text: result.extracted_text,
          metadata: {
            confidence: result.confidence,
            structured_data: result.structured_data,
            summary: result.summary,
            source: message.type,
            original_mime_type: mimeType,
          },
          source: message.type === "whatsapp_media" ? "whatsapp" : "upload",
        })
        .select()
        .single();

      if (error) {
        console.error("Error storing document:", error);
        continue;
      }

      console.log("Document stored:", doc.id);

      // Send WhatsApp confirmation if this came from WhatsApp
      if (message.type === "whatsapp_media" && message.user_id && whatsapp) {
        const { data: user } = await supabaseClient
          .from("users")
          .select("phone_number")
          .eq("id", message.user_id)
          .single();

        if (user?.phone_number) {
          await sendWhatsAppConfirmation(
            user.phone_number,
            result.summary,
            result.document_type,
            projectName,
            whatsapp
          );
        }
      }

      // Update usage tracking
      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      await supabaseClient.rpc("increment_usage", {
        p_tenant_id: message.tenant_id,
        p_month: currentMonth,
        p_documents_processed: 1,
      });

    } catch (error) {
      console.error("Error processing document:", error);
      // Don't throw - continue processing other records
    }
  }

  return { statusCode: 200, body: "OK" };
}
