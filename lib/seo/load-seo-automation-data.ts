import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SeoAutomationRegion = { id: string; name: string; slug: string };
export type SeoAutomationSuburb = {
  id: string;
  region_id: string;
  suburb_name: string;
  slug: string;
  postcode: string;
  priority: number;
  completed: boolean;
};

export async function loadSeoAutomationData(): Promise<{
  regions: SeoAutomationRegion[];
  suburbs: SeoAutomationSuburb[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { regions: [], suburbs: [] };
  }

  const { data: regionsRaw } = await admin
    .from("seo_regions")
    .select("id, name, slug")
    .eq("is_active", true);

  const regions = [...(regionsRaw ?? [])].sort((a, b) => {
    const ar = a as { slug: string };
    const br = b as { slug: string };
    if (ar.slug === "sunshine-coast") return -1;
    if (br.slug === "sunshine-coast") return 1;
    return String((a as { name: string }).name).localeCompare(String((b as { name: string }).name));
  });

  const { data: suburbs } = await admin
    .from("seo_suburbs")
    .select("id, region_id, suburb_name, slug, postcode, priority, completed")
    .order("priority", { ascending: true });

  return {
    regions: (regions ?? []) as SeoAutomationRegion[],
    suburbs: (suburbs ?? []) as SeoAutomationSuburb[],
  };
}
