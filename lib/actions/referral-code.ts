"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

/**
 * Ensure the user has a unique referral_code (8 chars). Idempotent.
 * Call from profile page when referrals are enabled.
 */
export async function ensureReferralCodeForUser(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const readCode = async (): Promise<string | null> => {
    const { data } = await admin.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
    return (data as { referral_code?: string | null } | null)?.referral_code?.trim() ?? null;
  };

  const existing = await readCode();
  if (existing) return existing;

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomSegment(8);
    const { data: updated, error } = await admin
      .from("profiles")
      .update({
        referral_code: code,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", userId)
      .is("referral_code", null)
      .select("referral_code")
      .maybeSingle();

    if (!error) {
      const set = (updated as { referral_code?: string | null } | null)?.referral_code?.trim();
      if (set) return set;
    } else {
      const msg = error.message?.toLowerCase() ?? "";
      if (!msg.includes("unique") && !msg.includes("duplicate")) {
        console.error("[ensureReferralCodeForUser]", error.message);
        return null;
      }
    }

    const raced = await readCode();
    if (raced) return raced;
  }

  return null;
}
