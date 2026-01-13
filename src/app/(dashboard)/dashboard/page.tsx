import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats, getRecentActivity, getAggregatedUsage } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, activity, usage] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(10),
    getAggregatedUsage(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your RoofGod platform
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Badge variant="secondary">Active</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
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
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
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
            <div className="text-2xl font-bold">{stats.messagesToday}</div>
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
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Files stored and indexed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage This Month */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>
              Platform-wide usage statistics for {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{usage.whatsappReceived}</div>
                <p className="text-xs text-muted-foreground">Messages Received</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{usage.whatsappSent}</div>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{usage.documentsProcessed}</div>
                <p className="text-xs text-muted-foreground">Documents Processed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{usage.emailsProcessed}</div>
                <p className="text-xs text-muted-foreground">Emails Processed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{(usage.bedrockInputTokens / 1000).toFixed(1)}k</div>
                <p className="text-xs text-muted-foreground">AI Input Tokens</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{(usage.bedrockOutputTokens / 1000).toFixed(1)}k</div>
                <p className="text-xs text-muted-foreground">AI Output Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest WhatsApp messages across all tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No activity yet</p>
              <p className="text-sm text-muted-foreground">
                Messages will appear here once users start chatting with the assistant
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                  <div className={`w-2 h-2 mt-2 rounded-full ${
                    item.direction === "inbound" ? "bg-blue-500" : "bg-green-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{item.user}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.tenant}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.direction}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.content || `[${item.messageType}]`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
