import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getTenants } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">
            Manage roofing companies using RoofGod
          </p>
        </div>
        <Button>Add Tenant</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            A list of all roofing companies registered on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No tenants yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first tenant to start testing the platform
              </p>
              <Button>Create First Tenant</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const userCount = Array.isArray(tenant.users)
                    ? tenant.users.length
                    : (tenant.users as any)?.count || 0;
                  const projectCount = Array.isArray(tenant.projects)
                    ? tenant.projects.length
                    : (tenant.projects as any)?.count || 0;

                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          {tenant.whatsapp_business_number && (
                            <p className="text-xs text-muted-foreground">
                              {tenant.whatsapp_business_number}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{userCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{projectCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {tenant.subscription_plan || "starter"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tenant.subscription_status === "active"
                              ? "default"
                              : tenant.subscription_status === "trialing"
                              ? "secondary"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {tenant.subscription_status || "trialing"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/tenants/${tenant.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
