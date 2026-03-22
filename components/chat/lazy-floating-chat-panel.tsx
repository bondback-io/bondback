"use client";

import dynamic from "next/dynamic";

const FloatingChatPanel = dynamic(
  () => import("@/components/chat/floating-chat-panel").then((m) => ({ default: m.FloatingChatPanel })),
  { ssr: false, loading: () => null }
);

export function LazyFloatingChatPanel({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <FloatingChatPanel />;
}
