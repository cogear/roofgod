import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Gmail OAuth configuration
export const GMAIL_CONFIG = {
  clientId: process.env.GOOGLE_GMAIL_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
  scopes: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
};

// Encryption key for storing tokens (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";

export function encryptToken(token: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedData: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GMAIL_CONFIG.clientId,
    redirect_uri: GMAIL_CONFIG.redirectUri,
    response_type: "code",
    scope: GMAIL_CONFIG.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GMAIL_CONFIG.clientId,
      client_secret: GMAIL_CONFIG.clientSecret,
      redirect_uri: GMAIL_CONFIG.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GMAIL_CONFIG.clientId,
      client_secret: GMAIL_CONFIG.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

export async function getGmailProfile(accessToken: string): Promise<{
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
}> {
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get Gmail profile");
  }

  return response.json();
}

export interface GmailMessage {
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

export async function listMessages(
  accessToken: string,
  query: string = "is:unread",
  maxResults: number = 10
): Promise<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string }> {
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
    throw new Error("Failed to list messages");
  }

  return response.json();
}

export async function getMessage(
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
    throw new Error("Failed to get message");
  }

  return response.json();
}

export function extractHeader(message: GmailMessage, headerName: string): string | undefined {
  return message.payload.headers.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase()
  )?.value;
}

export function decodeBase64(data: string): string {
  // Gmail uses URL-safe base64
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}
