import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTenantById } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await getTenantById(id);

  if (!tenant) {
    notFound();
  }

  const users = tenant.users || [];
  const projects = tenant.projects || [];
  const emailAccounts = tenant.email_accounts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/tenants">
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={
                tenant.subscription_status === "active"
                  ? "default"
                  : "secondary"
              }
              className="capitalize"
            >
              {tenant.subscription_status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {tenant.subscription_plan} plan
            </Badge>
            {tenant.whatsapp_business_number && (
              <Badge variant="outline">
                WhatsApp: {tenant.whatsapp_business_number}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tenant Info */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p>{tenant.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Timezone</p>
              <p>{tenant.timezone || "America/New_York"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p>{new Date(tenant.created_at).toLocaleString()}</p>
            </div>
            {tenant.stripe_customer_id && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stripe Customer</p>
                <p className="font-mono text-sm">{tenant.stripe_customer_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              Email accounts linked to this tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No email accounts connected
              </p>
            ) : (
              <div className="space-y-2">
                {emailAccounts.map((account: any) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div>
                      <p className="font-medium">{account.email_address}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {account.provider}
                      </p>
                    </div>
                    <Badge variant={account.is_active ? "default" : "secondary"}>
                      {account.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
          <CardDescription>
            Managers and crew members in this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || "Unknown"}
                    </TableCell>
                    <TableCell>{user.phone_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.last_seen_at
                        ? new Date(user.last_seen_at).toLocaleString()
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Projects ({projects.length})</CardTitle>
          <CardDescription>
            Roofing jobs for this company
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project: any) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.address || "-"}</TableCell>
                    <TableCell>{project.customer_name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          project.status === "active"
                            ? "default"
                            : project.status === "completed"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {project.start_date
                        ? new Date(project.start_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      {tenant.settings && Object.keys(tenant.settings).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tenant Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
              {JSON.stringify(tenant.settings, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
