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
  /** Admin-authored row: party visibility (admin console may show internal notes). */
  visible_to_lister?: boolean;
  visible_to_cleaner?: boolean;
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
    const authorRole = String(row.author_role ?? "user");
    const vL = row.visible_to_lister === true;
    const vC = row.visible_to_cleaner === true;
    const base: SerializableDisputeMessage = {
      id: idRaw != null ? String(idRaw as string | number | bigint) : "",
      body: String(row.body ?? ""),
      author_role: authorRole,
      created_at:
        row.created_at == null
          ? ""
          : typeof row.created_at === "string"
            ? row.created_at
            : new Date(row.created_at as string | number).toISOString(),
      is_escalation_event: Boolean(row.is_escalation_event),
      ...(attachment_urls.length > 0 ? { attachment_urls } : {}),
    };
    if (authorRole.toLowerCase() === "admin") {
      return { ...base, visible_to_lister: vL, visible_to_cleaner: vC };
    }
    return base;
  });
}
