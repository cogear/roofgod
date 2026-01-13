import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDocumentById } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const document = await getDocumentById(id);

  if (!document) {
    notFound();
  }

  const metadata = (document.metadata as any) || {};
  const structuredData = metadata.structured_data || {};
  const tenant = document.tenants as any;
  const project = document.projects as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/documents">
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{document.filename}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="capitalize">
              {document.document_type?.replace("_", " ") || "unknown"}
            </Badge>
            {tenant?.name && <Badge variant="secondary">{tenant.name}</Badge>}
            {metadata.confidence && (
              <Badge variant="outline">
                {(metadata.confidence * 100).toFixed(0)}% confidence
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Document Info */}
        <Card>
          <CardHeader>
            <CardTitle>Document Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Filename</p>
              <p>{document.filename}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="capitalize">{document.document_type?.replace("_", " ") || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p>{new Date(document.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Source</p>
              <p className="capitalize">{document.source || "Unknown"}</p>
            </div>
            {project && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project</p>
                <p>{project.name}</p>
                {project.address && (
                  <p className="text-sm text-muted-foreground">{project.address}</p>
                )}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">S3 Key</p>
              <p className="text-xs font-mono break-all">{document.s3_key}</p>
            </div>
          </CardContent>
        </Card>

        {/* AI Summary */}
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
            <CardDescription>
              Extracted information from Claude Vision
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metadata.summary && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Summary</p>
                <p>{metadata.summary}</p>
              </div>
            )}
            {structuredData.addresses?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Addresses</p>
                <ul className="list-disc list-inside">
                  {structuredData.addresses.map((addr: string, i: number) => (
                    <li key={i}>{addr}</li>
                  ))}
                </ul>
              </div>
            )}
            {structuredData.dates?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dates</p>
                <ul className="list-disc list-inside">
                  {structuredData.dates.map((date: string, i: number) => (
                    <li key={i}>{date}</li>
                  ))}
                </ul>
              </div>
            )}
            {structuredData.amounts?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Amounts</p>
                <ul className="list-disc list-inside">
                  {structuredData.amounts.map((amt: any, i: number) => (
                    <li key={i}>
                      {amt.currency} {amt.value.toFixed(2)}
                      {amt.description && ` - ${amt.description}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {structuredData.names?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Names</p>
                <ul className="list-disc list-inside">
                  {structuredData.names.map((name: string, i: number) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
            {structuredData.permit_number && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Permit Number</p>
                <p>{structuredData.permit_number}</p>
              </div>
            )}
            {structuredData.invoice_number && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                <p>{structuredData.invoice_number}</p>
              </div>
            )}
            {structuredData.policy_number && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Policy Number</p>
                <p>{structuredData.policy_number}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extracted Text */}
      {document.extracted_text && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Text</CardTitle>
            <CardDescription>
              Full text content extracted from the document
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded max-h-96 overflow-y-auto">
              {document.extracted_text}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Raw Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Raw Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-x-auto max-h-64">
            {JSON.stringify(document.metadata, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
