import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  getGmailProfile,
  encryptToken,
} from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=missing_params", request.url)
    );
  }

  // Verify state parameter
  const cookieStore = await cookies();
  const storedState = cookieStore.get("gmail_oauth_state")?.value;

  if (!storedState) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=invalid_state", request.url)
    );
  }

  let state: { csrf: string; tenantId: string; returnUrl: string };
  try {
    const decodedState = Buffer.from(stateParam, "base64").toString("utf8");
    state = JSON.parse(decodedState);

    // Verify stored state matches
    if (storedState !== decodedState) {
      throw new Error("State mismatch");
    }
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=invalid_state", request.url)
    );
  }

  // Clear the state cookie
  cookieStore.delete("gmail_oauth_state");

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      console.error("No refresh token received - user may have already connected");
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=no_refresh_token", request.url)
      );
    }

    // Get Gmail profile to get email address
    const profile = await getGmailProfile(tokens.access_token);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store in Supabase
    const supabase = createAdminClient();

    const { error: dbError } = await supabase.from("email_accounts").upsert(
      {
        tenant_id: state.tenantId,
        provider: "gmail",
        email_address: profile.emailAddress,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        is_active: true,
        last_sync_at: null,
      },
      {
        onConflict: "tenant_id,email_address",
      }
    );

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=database_error", request.url)
      );
    }

    // Success - redirect back to settings
    return NextResponse.redirect(
      new URL(`${state.returnUrl}?gmail_connected=true`, request.url)
    );
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=oauth_failed", request.url)
    );
  }
}
