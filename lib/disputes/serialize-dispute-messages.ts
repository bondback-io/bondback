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
};

export function serializeDisputeMessagesForClient(raw: unknown): SerializableDisputeMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const row = m as Record<string, unknown>;
    const idRaw = row.id;
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
    };
  });
}
