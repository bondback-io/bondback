import type { Database } from "@/types/supabase";

export const ADMIN_NOTIFICATION_LOG_PAGE_SIZE = 10;

export type AdminEmailLogRow = Pick<
  Database["public"]["Tables"]["email_logs"]["Row"],
  "id" | "user_id" | "type" | "sent_at" | "subject"
>;

export type AdminInAppNotificationRow = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "user_id" | "type" | "job_id" | "message_text" | "is_read" | "created_at"
>;

export type ProfileNameMap = Record<string, { full_name: string | null }>;
