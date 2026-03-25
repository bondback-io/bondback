/**
 * Realtime subscription helpers — use narrow `postgres_changes` filters so replicas
 * only evaluate rows you care about (chat/notifications already pass `filter` in components).
 */
export function realtimeFilterJobMessages(jobId: number): string {
  return `job_id=eq.${jobId}`;
}

export function realtimeFilterNotificationsUser(userId: string): string {
  return `user_id=eq.${userId}`;
}

export function realtimeFilterListingsLive(): string {
  return "status=eq.live";
}
