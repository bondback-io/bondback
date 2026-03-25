import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { CACHE_TAGS } from "@/lib/cache-tags";

type GlobalSettingsRow = NonNullable<Awaited<ReturnType<typeof getGlobalSettings>>>;

/**
 * Cached read of `global_settings` via service role (same source as getGlobalSettings when admin works).
 * Falls back to uncached `getGlobalSettings()` if admin client is unavailable (local dev without service role).
 */
export async function getCachedGlobalSettingsForPages(): Promise<GlobalSettingsRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return getGlobalSettings();
  }

  const readCachedRow = unstable_cache(
    async () => {
      const a = createSupabaseAdminClient();
      if (!a) return null;
      const { data, error } = await a
        .from("global_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) return null;
      return (data as GlobalSettingsRow | null) ?? null;
    },
    ["global-settings-row-v1"],
    { revalidate: 120, tags: [CACHE_TAGS.globalSettings] }
  );

  const row = (await readCachedRow()) ?? null;

  return row ?? getGlobalSettings();
}
