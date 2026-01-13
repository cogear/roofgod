"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealtimeUpdates, type RealtimeUpdate } from "@/lib/supabase/realtime";

export function RealtimeBanner() {
  const router = useRouter();
  const { updates, isConnected } = useRealtimeUpdates((update) => {
    // Auto-refresh relevant pages when new data comes in
    if (update.type === "message" && update.action === "INSERT") {
      // Could trigger a toast notification here
      console.log("New message received:", update.data);
    }
  });

  const recentUpdates = updates.slice(0, 3);

  if (!isConnected && updates.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {/* Connection Status */}
      <div className="mb-2 flex items-center justify-end gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-xs text-muted-foreground">
          {isConnected ? "Live" : "Connecting..."}
        </span>
      </div>

      {/* Recent Updates */}
      {recentUpdates.length > 0 && (
        <div className="bg-background border rounded-lg shadow-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Live Updates</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.refresh()}
            >
              Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {recentUpdates.map((update, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">
                  {update.type}
                </Badge>
                <span className="text-muted-foreground truncate">
                  {update.action === "INSERT" && "New "}
                  {update.action === "UPDATE" && "Updated "}
                  {update.action === "DELETE" && "Deleted "}
                  {update.type}
                  {update.data?.content && (
                    <span className="ml-1 opacity-70">
                      : {update.data.content.substring(0, 30)}...
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
