import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";

/**
 * Show "Complete your first job to unlock rewards" for cleaners with no completed jobs,
 * when referrals are enabled (rewards are referral-based).
 */
export const getFirstJobRewardsNudgeVisible = cache(
  async (userId: string | null): Promise<boolean> => {
    if (!userId) return false;
    const settings = await getGlobalSettings();
    if (!settings?.referral_enabled) return false;

    const supabase = await createServerSupabaseClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", userId)
      .maybeSingle();

    const roles = (profile as { roles?: string[] | null } | null)?.roles ?? [];
    if (!Array.isArray(roles) || !roles.includes("cleaner")) return false;

    const { count, error } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("winner_id", userId)
      .eq("status", "completed");

    if (error) return false;
    return (count ?? 0) === 0;
  }
);
