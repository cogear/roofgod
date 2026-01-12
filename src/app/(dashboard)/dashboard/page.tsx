import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your RoofGod platform
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Badge variant="secondary">Active</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Roofing companies using RoofGod
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Managers and crew members
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              WhatsApp messages processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Files stored and indexed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Checklist</CardTitle>
          <CardDescription>
            Complete these steps to get RoofGod running
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">
                ✓
              </div>
              <div>
                <p className="font-medium">Deploy Next.js app</p>
                <p className="text-sm text-muted-foreground">Application is running</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                2
              </div>
              <div>
                <p className="font-medium">Configure Supabase</p>
                <p className="text-sm text-muted-foreground">Set up database and run migrations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                3
              </div>
              <div>
                <p className="font-medium">Set up WhatsApp Business</p>
                <p className="text-sm text-muted-foreground">Configure AWS End User Messaging</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                4
              </div>
              <div>
                <p className="font-medium">Configure Bedrock Agent</p>
                <p className="text-sm text-muted-foreground">Set up AWS AgentCore with action groups</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                5
              </div>
              <div>
                <p className="font-medium">Create first tenant</p>
                <p className="text-sm text-muted-foreground">Add a roofing company to test with</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
