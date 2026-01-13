import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDocuments } from "@/lib/dashboard/actions";

export const dynamic = "force-dynamic";

const documentTypeColors: Record<string, string> = {
  permit: "bg-blue-100 text-blue-800",
  invoice: "bg-green-100 text-green-800",
  receipt: "bg-yellow-100 text-yellow-800",
  photo: "bg-purple-100 text-purple-800",
  insurance_scope: "bg-orange-100 text-orange-800",
  change_order: "bg-red-100 text-red-800",
  contract: "bg-indigo-100 text-indigo-800",
  estimate: "bg-pink-100 text-pink-800",
  general: "bg-gray-100 text-gray-800",
  other: "bg-gray-100 text-gray-800",
};

export default async function DocumentsPage() {
  const documents = await getDocuments(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Browse all documents stored across tenants
        </p>
      </div>

      {/* Document Type Summary */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        {["permit", "invoice", "receipt", "photo", "insurance_scope", "change_order", "contract", "other"].map((type) => {
          const count = documents.filter((d) => d.document_type === type).length;
          return (
            <Card key={type} className="text-center">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground capitalize">
                  {type.replace("_", " ")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
          <CardDescription>
            Permits, invoices, receipts, and photos organized by tenant and project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No documents yet</p>
              <p className="text-sm text-muted-foreground">
                Documents will appear here once users send photos or files via WhatsApp,
                or when emails with attachments are processed
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const metadata = doc.metadata as any || {};
                return (
                  <Link
                    key={doc.id}
                    href={`/dashboard/documents/${doc.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          {doc.document_type === "photo" ? (
                            <span className="text-xl">📷</span>
                          ) : doc.document_type === "permit" ? (
                            <span className="text-xl">📋</span>
                          ) : doc.document_type === "invoice" ? (
                            <span className="text-xl">💰</span>
                          ) : doc.document_type === "receipt" ? (
                            <span className="text-xl">🧾</span>
                          ) : doc.document_type === "insurance_scope" ? (
                            <span className="text-xl">🛡️</span>
                          ) : (
                            <span className="text-xl">📄</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate max-w-[300px]">
                              {doc.filename}
                            </span>
                            <Badge
                              className={`text-xs ${
                                documentTypeColors[doc.document_type] || documentTypeColors.other
                              }`}
                            >
                              {doc.document_type?.replace("_", " ") || "unknown"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {(doc.projects as any)?.name && (
                              <span>Project: {(doc.projects as any).name}</span>
                            )}
                            {(doc.projects as any)?.address && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[200px]">
                                  {(doc.projects as any).address}
                                </span>
                              </>
                            )}
                          </div>
                          {metadata.summary && (
                            <p className="text-sm text-muted-foreground mt-1 truncate max-w-[500px]">
                              {metadata.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">
                          {(doc.tenants as any)?.name || "Unknown"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.created_at).toLocaleString()}
                        </p>
                        {metadata.confidence && (
                          <p className="text-xs text-muted-foreground">
                            Confidence: {(metadata.confidence * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
