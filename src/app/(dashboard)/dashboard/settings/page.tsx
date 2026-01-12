import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Platform configuration and integrations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Supabase
              <Badge variant="secondary">Not Connected</Badge>
            </CardTitle>
            <CardDescription>
              Database and authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure your Supabase connection in environment variables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              AWS Bedrock
              <Badge variant="secondary">Not Connected</Badge>
            </CardTitle>
            <CardDescription>
              AI agent and document processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure AWS credentials and AgentCore in environment variables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              WhatsApp Business
              <Badge variant="secondary">Not Connected</Badge>
            </CardTitle>
            <CardDescription>
              AWS End User Messaging for WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Set up WhatsApp Business API through AWS End User Messaging
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Gmail Integration
              <Badge variant="secondary">Not Connected</Badge>
            </CardTitle>
            <CardDescription>
              Email polling and document extraction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure Google OAuth credentials for Gmail API access
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
