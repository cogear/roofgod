import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getConversations } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const conversations = await getConversations(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">
          View WhatsApp conversations across all tenants
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
          <CardDescription>
            WhatsApp message threads with the AI assistant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No conversations yet</p>
              <p className="text-sm text-muted-foreground">
                Conversations will appear here once users start messaging the WhatsApp assistant
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/dashboard/conversations/${conv.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {((conv.users as any)?.name || "U")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {(conv.users as any)?.name || "Unknown User"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {(conv.users as any)?.role || "user"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{(conv.users as any)?.phone_number}</span>
                          {(conv.projects as any)?.name && (
                            <>
                              <span>•</span>
                              <span>Project: {(conv.projects as any)?.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-1">
                        {(conv.tenants as any)?.name || "Unknown"}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleString()
                          : "No messages"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
