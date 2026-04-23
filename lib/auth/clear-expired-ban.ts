import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isProfileBanActiveForAccess } from "@/lib/profile-ban";

/** If ban_until is in the past, clear ban flags so the user can sign in again. */
export async function clearExpiredMarketplaceBanIfNeeded(userId: string): Promise<void> {
  const uid = String(userId ?? "").trim();
  if (!uid) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from("profiles")
    .select("is_banned, ban_until")
    .eq("id", uid)
    .maybeSingle();
  const p = data as { is_banned?: boolean | null; ban_until?: string | null } | null;
  if (!p?.is_banned) return;
  if (isProfileBanActiveForAccess(p)) return;
  await admin
    .from("profiles")
    .update({
      is_banned: false,
      ban_until: null,
      banned_reason: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", uid);
}
