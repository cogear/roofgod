import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getAuthUrl } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  // Verify user is authenticated
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Get tenant_id from query params (passed from dashboard)
  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
  }

  // Generate state parameter for CSRF protection
  const state = JSON.stringify({
    csrf: randomBytes(16).toString("hex"),
    tenantId,
    returnUrl: request.nextUrl.searchParams.get("return_url") || "/dashboard/settings",
  });

  // Store state in cookie for verification
  const cookieStore = await cookies();
  cookieStore.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  // Redirect to Google OAuth
  const authUrl = getAuthUrl(Buffer.from(state).toString("base64"));
  return NextResponse.redirect(authUrl);
}
