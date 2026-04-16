import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  createSupabaseAdminClient,
  listAllAuthUsersPaginated,
} from "@/lib/supabase/admin";

type AdminClient = SupabaseClient<Database>;

/**
 * Resolve a profile UUID from admin search: full UUID, email, or cleaner @handle (with or without @).
 * Used so Admin → Reviews can find rows that have no review text.
 */
export async function resolveUserIdForReviewAdminSearch(
  admin: AdminClient,
  raw: string
): Promise<string | null> {
  const t = raw.trim();
  if (!t) return null;

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
  ) {
    const { data } = await admin.from("profiles").select("id").eq("id", t).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  if (t.includes("@") && t.length > 3 && !t.startsWith("@")) {
    const email = t.toLowerCase();
    const typed = (admin as NonNullable<ReturnType<typeof createSupabaseAdminClient>>);
    const users = await listAllAuthUsersPaginated(typed);
    return users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
  }

  const uname = t.startsWith("@") ? t.slice(1).toLowerCase() : t.toLowerCase();
  if (uname.length === 0) return null;

  const { data: byExact } = await admin
    .from("profiles")
    .select("id")
    .ilike("cleaner_username", uname)
    .maybeSingle();
  const id = (byExact as { id: string } | null)?.id;
  if (id) return id;

  return null;
}
