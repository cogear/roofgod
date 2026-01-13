"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mail, Trash2, RefreshCw } from "lucide-react";
import { disconnectEmailAccount, toggleEmailAccountActive } from "@/lib/gmail/actions";

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

interface GmailSettingsProps {
  tenantId: string;
  accounts: EmailAccount[];
}

export function GmailSettings({ tenantId, accounts }: GmailSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState(accounts);

  const handleConnect = () => {
    window.location.href = `/api/gmail/authorize?tenant_id=${tenantId}&return_url=/dashboard/settings`;
  };

  const handleDisconnect = async (accountId: string) => {
    setLoading(true);
    const result = await disconnectEmailAccount(accountId, tenantId);
    setLoading(false);

    if (result.success) {
      setEmailAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast.success("Email account disconnected");
    } else {
      toast.error(result.error || "Failed to disconnect");
    }
  };

  const handleToggleActive = async (accountId: string, currentState: boolean) => {
    const result = await toggleEmailAccountActive(accountId, tenantId, !currentState);

    if (result.success) {
      setEmailAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId ? { ...a, is_active: !currentState } : a
        )
      );
      toast.success(`Email polling ${!currentState ? "enabled" : "disabled"}`);
    } else {
      toast.error(result.error || "Failed to update");
    }
  };

  const hasConnectedAccounts = emailAccounts.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail Integration
          </span>
          {hasConnectedAccounts ? (
            <Badge variant="default">Connected</Badge>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect Gmail to automatically poll emails for your tenants
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {emailAccounts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              No email accounts connected. Connect Gmail to enable email polling and
              notifications.
            </p>
            <Button onClick={handleConnect} disabled={loading}>
              <Mail className="mr-2 h-4 w-4" />
              Connect Gmail
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {emailAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{account.email_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.last_sync_at
                          ? `Last synced: ${new Date(account.last_sync_at).toLocaleString()}`
                          : "Never synced"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(account.id, account.is_active)
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDisconnect(account.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={handleConnect} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Connect Another Account
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
