/**
 * Normalize dispute photo URL lists from `jobs` or `dispute_messages`.
 * PostgREST / drivers may occasionally return non-array shapes; merge legacy + new columns safely.
 */
export function coerceDisputePhotoUrls(
  ...inputs: (unknown | null | undefined)[]
): string[] {
  const out: string[] = [];
  for (const value of inputs) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const u of value) {
        const s = String(u ?? "").trim();
        if (s) out.push(s);
      }
      continue;
    }
    if (typeof value === "string") {
      const t = value.trim();
      if (!t) continue;
      if (t.startsWith("[") && t.endsWith("]")) {
        try {
          const parsed = JSON.parse(t) as unknown;
          if (Array.isArray(parsed)) {
            for (const u of parsed) {
              const s = String(u ?? "").trim();
              if (s) out.push(s);
            }
            continue;
          }
        } catch {
          /* treat as plain string below */
        }
      }
      out.push(t);
    }
  }
  return [...new Set(out)];
}
