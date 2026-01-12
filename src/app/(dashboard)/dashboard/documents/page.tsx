import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Browse all documents stored across tenants
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
          <CardDescription>
            Permits, invoices, receipts, and photos organized by tenant and project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No documents yet</p>
            <p className="text-sm text-muted-foreground">
              Documents will appear here once users send photos or files via WhatsApp,
              or when emails with attachments are processed
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
