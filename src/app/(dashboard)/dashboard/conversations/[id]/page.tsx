import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConversationById } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const conversation = await getConversationById(id);

  if (!conversation) {
    notFound();
  }

  const user = conversation.users as any;
  const tenant = conversation.tenants as any;
  const project = conversation.projects as any;
  const messages = conversation.messages || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/conversations">
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user?.name || "Unknown User"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{user?.role || "user"}</Badge>
            <span className="text-muted-foreground">{user?.phone_number}</span>
            {tenant?.name && (
              <>
                <span className="text-muted-foreground">•</span>
                <Badge variant="secondary">{tenant.name}</Badge>
              </>
            )}
          </div>
        </div>
        {project && (
          <Card className="w-64">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Current Project</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <p className="font-medium">{project.name}</p>
              {project.address && (
                <p className="text-sm text-muted-foreground">{project.address}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            {messages.length} messages in this conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.direction === "outbound" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.direction === "outbound"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={msg.direction === "outbound" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {msg.direction === "outbound" ? "Assistant" : "User"}
                      </Badge>
                      {msg.message_type !== "text" && (
                        <Badge variant="outline" className="text-xs">
                          {msg.message_type}
                        </Badge>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content || `[${msg.message_type}]`}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                      <span>{new Date(msg.created_at).toLocaleString()}</span>
                      {msg.processing_time_ms && (
                        <span>• {msg.processing_time_ms}ms</span>
                      )}
                      {msg.agent_model && (
                        <span>• {msg.agent_model}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Context */}
      {conversation.context && Object.keys(conversation.context).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversation Context</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
              {JSON.stringify(conversation.context, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
