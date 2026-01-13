import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUsageStats, getTenants, getAggregatedUsage } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [usageData, tenants, aggregatedUsage] = await Promise.all([
    getUsageStats(),
    getTenants(),
    getAggregatedUsage(),
  ]);

  // Group usage by tenant
  const usageByTenant = usageData.reduce((acc, usage) => {
    const tenantId = usage.tenant_id;
    if (!acc[tenantId]) {
      acc[tenantId] = [];
    }
    acc[tenantId].push(usage);
    return acc;
  }, {} as Record<string, typeof usageData>);

  // Calculate totals per tenant
  const tenantTotals = Object.entries(usageByTenant).map(([tenantId, usages]) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    const totals = usages.reduce(
      (acc, u) => ({
        whatsappReceived: acc.whatsappReceived + (u.whatsapp_messages_received || 0),
        whatsappSent: acc.whatsappSent + (u.whatsapp_messages_sent || 0),
        documentsProcessed: acc.documentsProcessed + (u.documents_processed || 0),
        emailsProcessed: acc.emailsProcessed + (u.emails_processed || 0),
        bedrockInputTokens: acc.bedrockInputTokens + (u.bedrock_input_tokens || 0),
        bedrockOutputTokens: acc.bedrockOutputTokens + (u.bedrock_output_tokens || 0),
      }),
      {
        whatsappReceived: 0,
        whatsappSent: 0,
        documentsProcessed: 0,
        emailsProcessed: 0,
        bedrockInputTokens: 0,
        bedrockOutputTokens: 0,
      }
    );
    return {
      tenantId,
      tenantName: tenant?.name || "Unknown",
      ...totals,
    };
  });

  // Sort by total messages
  tenantTotals.sort((a, b) =>
    (b.whatsappReceived + b.whatsappSent) - (a.whatsappReceived + a.whatsappSent)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Platform usage statistics and metrics
        </p>
      </div>

      {/* Platform-Wide Stats */}
      {aggregatedUsage && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Usage This Month</CardTitle>
            <CardDescription>
              Aggregated statistics for {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  {aggregatedUsage.whatsappReceived}
                </div>
                <p className="text-sm text-blue-600/80">Messages Received</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  {aggregatedUsage.whatsappSent}
                </div>
                <p className="text-sm text-green-600/80">Messages Sent</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">
                  {aggregatedUsage.documentsProcessed}
                </div>
                <p className="text-sm text-purple-600/80">Documents Processed</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">
                  {aggregatedUsage.emailsProcessed}
                </div>
                <p className="text-sm text-orange-600/80">Emails Processed</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-600">
                  {(aggregatedUsage.bedrockInputTokens / 1000).toFixed(1)}k
                </div>
                <p className="text-sm text-gray-600/80">AI Input Tokens</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-600">
                  {(aggregatedUsage.bedrockOutputTokens / 1000).toFixed(1)}k
                </div>
                <p className="text-sm text-gray-600/80">AI Output Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage by Tenant */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Tenant</CardTitle>
          <CardDescription>
            Breakdown of usage statistics per roofing company
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantTotals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No usage data yet</p>
              <p className="text-sm text-muted-foreground">
                Usage statistics will appear here once tenants start using the platform
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Tenant</th>
                    <th className="text-right py-3 px-4 font-medium">Messages In</th>
                    <th className="text-right py-3 px-4 font-medium">Messages Out</th>
                    <th className="text-right py-3 px-4 font-medium">Documents</th>
                    <th className="text-right py-3 px-4 font-medium">Emails</th>
                    <th className="text-right py-3 px-4 font-medium">AI Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantTotals.map((tenant) => (
                    <tr key={tenant.tenantId} className="border-b last:border-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tenant.tenantName}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline" className="bg-blue-50">
                          {tenant.whatsappReceived}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline" className="bg-green-50">
                          {tenant.whatsappSent}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline" className="bg-purple-50">
                          {tenant.documentsProcessed}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline" className="bg-orange-50">
                          {tenant.emailsProcessed}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {((tenant.bedrockInputTokens + tenant.bedrockOutputTokens) / 1000).toFixed(1)}k
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Estimates */}
      {aggregatedUsage && (
        <Card>
          <CardHeader>
            <CardTitle>Estimated Costs</CardTitle>
            <CardDescription>
              Approximate AWS costs based on usage (estimates only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Bedrock (Claude)</p>
                <p className="text-2xl font-bold">
                  ${(
                    (aggregatedUsage.bedrockInputTokens * 0.000003) +
                    (aggregatedUsage.bedrockOutputTokens * 0.000015)
                  ).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Based on Claude 3 Sonnet pricing
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">WhatsApp Messages</p>
                <p className="text-2xl font-bold">
                  ${(
                    (aggregatedUsage.whatsappReceived + aggregatedUsage.whatsappSent) * 0.005
                  ).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ~$0.005 per message estimate
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Document Processing</p>
                <p className="text-2xl font-bold">
                  ${(aggregatedUsage.documentsProcessed * 0.01).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ~$0.01 per document estimate
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-primary/5">
                <p className="text-sm text-muted-foreground mb-1">Total Estimated</p>
                <p className="text-2xl font-bold text-primary">
                  ${(
                    (aggregatedUsage.bedrockInputTokens * 0.000003) +
                    (aggregatedUsage.bedrockOutputTokens * 0.000015) +
                    ((aggregatedUsage.whatsappReceived + aggregatedUsage.whatsappSent) * 0.005) +
                    (aggregatedUsage.documentsProcessed * 0.01)
                  ).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
