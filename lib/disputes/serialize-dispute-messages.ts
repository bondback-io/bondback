/**
 * RSC → client props must be JSON-serializable. Supabase may return bigint for
 * `job_id` on related rows; never pass raw rows into client components.
 */
export type SerializableDisputeMessage = {
  id: string;
  body: string;
  author_role: string;
  created_at: string;
  is_escalation_event?: boolean | null;
  attachment_urls?: string[];
};

export function serializeDisputeMessagesForClient(raw: unknown): SerializableDisputeMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const row = m as Record<string, unknown>;
    const idRaw = row.id;
    const att = row.attachment_urls;
    const attachment_urls = Array.isArray(att)
      ? att.map((u) => String(u)).filter(Boolean).slice(0, 12)
      : [];
    return {
      id: idRaw != null ? String(idRaw as string | number | bigint) : "",
      body: String(row.body ?? ""),
      author_role: String(row.author_role ?? "user"),
      created_at:
        row.created_at == null
          ? ""
          : typeof row.created_at === "string"
            ? row.created_at
            : new Date(row.created_at as string | number).toISOString(),
      is_escalation_event: Boolean(row.is_escalation_event),
      ...(attachment_urls.length > 0 ? { attachment_urls } : {}),
    };
  });
}
