"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getConnectedEmailAccounts(tenantId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, provider, is_active, last_sync_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching email accounts:", error);
    return [];
  }

  return data || [];
}

export async function disconnectEmailAccount(accountId: string, tenantId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("id", accountId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error disconnecting email account:", error);
    return { success: false, error: "Failed to disconnect account" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function toggleEmailAccountActive(
  accountId: string,
  tenantId: string,
  isActive: boolean
) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("email_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error toggling email account:", error);
    return { success: false, error: "Failed to update account" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
