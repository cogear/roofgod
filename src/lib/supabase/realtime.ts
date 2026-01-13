"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeMessage {
  id: string;
  conversation_id: string;
  direction: string;
  content: string;
  created_at: string;
}

interface RealtimeDocument {
  id: string;
  filename: string;
  document_type: string;
  created_at: string;
}

export interface RealtimeUpdate {
  type: "message" | "document" | "conversation";
  action: "INSERT" | "UPDATE" | "DELETE";
  data: any;
  timestamp: string;
}

export function useRealtimeUpdates(onUpdate?: (update: RealtimeUpdate) => void) {
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleUpdate = useCallback(
    (update: RealtimeUpdate) => {
      setUpdates((prev) => [update, ...prev].slice(0, 50)); // Keep last 50 updates
      onUpdate?.(update);
    },
    [onUpdate]
  );

  useEffect(() => {
    const supabase = createClient();
    let channels: RealtimeChannel[] = [];

    // Subscribe to messages
    const messagesChannel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          handleUpdate({
            type: "message",
            action: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            data: payload.new || payload.old,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        }
      });
    channels.push(messagesChannel);

    // Subscribe to documents
    const documentsChannel = supabase
      .channel("documents-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          handleUpdate({
            type: "document",
            action: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            data: payload.new || payload.old,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .subscribe();
    channels.push(documentsChannel);

    // Subscribe to conversations
    const conversationsChannel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          handleUpdate({
            type: "conversation",
            action: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            data: payload.new || payload.old,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .subscribe();
    channels.push(conversationsChannel);

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      setIsConnected(false);
    };
  }, [handleUpdate]);

  return { updates, isConnected };
}

export function useRealtimeMessages(conversationId?: string) {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RealtimeMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return messages;
}
