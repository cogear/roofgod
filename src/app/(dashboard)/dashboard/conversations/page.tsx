import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConversationsPage() {
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
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No conversations yet</p>
            <p className="text-sm text-muted-foreground">
              Conversations will appear here once users start messaging the WhatsApp assistant
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
