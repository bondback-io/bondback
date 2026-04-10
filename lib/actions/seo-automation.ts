"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/supabase";
import { buildLocationSlug } from "@/lib/seo/location-slug";
import { generateSeoPackWithAi, normalizeBundle, sanitizeMarkdown } from "@/lib/seo/seo-generation-ai";
import { buildTemplateSeoBundle } from "@/lib/seo/seo-template-content";
import type { SeoGeneratedBundle } from "@/lib/seo/seo-content-types";
import { logSeoError, logSeoInfo } from "@/lib/seo/seo-generation-logger";
import { getSiteUrl } from "@/lib/site";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function isAdminTruthy(v: ProfileRow["is_admin"]): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  return ["true", "t", "yes", "1"].includes(String(v).trim().toLowerCase());
}

async function requireAdminUserId(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error("You must be signed in.");
  }
  const { data: profileData } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = profileData as Pick<ProfileRow, "is_admin"> | null;
  if (!profile || !isAdminTruthy(profile.is_admin)) {
    throw new Error("Admin access required.");
  }
  return session.user.id;
}

function bundleToRowJson(bundle: SeoGeneratedBundle): {
  landing: Json;
  blog_posts: Json;
  faq_schema: Json;
} {
  return {
    landing: bundle.landing as unknown as Json,
    blog_posts: bundle.blogPosts as unknown as Json,
    faq_schema: bundle.faq as unknown as Json,
  };
}

function regionStateForSlug(_regionSlug: string): "QLD" {
  return "QLD";
}

export type SeoSuburbStatus = {
  id: string;
  suburbName: string;
  slug: string;
  postcode: string;
  priority: number;
  completed: boolean;
  completedAt: string | null;
  pageSlug: string | null;
  lastError: string | null;
};

export type SeoProgressResult = {
  ok: true;
  regionSlug: string;
  regionName: string;
  completionPct: number;
  total: number;
  completed: number;
  suburbs: SeoSuburbStatus[];
};

/**
 * Full SEO generation (landing + blog + FAQ) for up to 3 suburbs at a time.
 */
export async function generateSeoForSuburbs(
  suburbIds: string[]
): Promise<
  | {
      ok: true;
      generated: Array<{
        suburbId: string;
        pageSlug: string;
        pageUrl: string;
        /** On-page guide anchors (same bond-cleaning URL + hash per blog block). */
        extraUrls: string[];
      }>;
    }
  | { ok: false; error: string }
> {
  try {
    await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (no admin client)." };
    }

    const ids = suburbIds.filter(Boolean).slice(0, 3);
    if (ids.length === 0) {
      return { ok: false, error: "Select at least one suburb." };
    }

    const siteOrigin = getSiteUrl().origin;
    const generated: Array<{
      suburbId: string;
      pageSlug: string;
      pageUrl: string;
      extraUrls: string[];
    }> = [];

    for (const suburbId of ids) {
      const { data: sub, error: subErr } = await admin
        .from("seo_suburbs")
        .select("id, suburb_name, postcode, slug, region_id, seo_regions (name, slug)")
        .eq("id", suburbId)
        .maybeSingle();

      if (subErr || !sub) {
        logSeoError("suburb not found", subErr ?? new Error("missing"), { suburbId });
        continue;
      }

      const row = sub as {
        id: string;
        suburb_name: string;
        postcode: string;
        slug: string;
        region_id: string;
        seo_regions: { name: string; slug: string } | { name: string; slug: string }[] | null;
      };
      const region = Array.isArray(row.seo_regions) ? row.seo_regions[0] : row.seo_regions;
      const regionName = region?.name ?? "Queensland";
      const regionSlug = region?.slug ?? "";
      const state = regionStateForSlug(regionSlug);
      const pageSlug = buildLocationSlug(row.suburb_name, state, row.postcode);

      let bundle: SeoGeneratedBundle;
      try {
        bundle = await generateSeoPackWithAi({
          suburbName: row.suburb_name,
          postcode: row.postcode,
          state,
          regionName,
          pageSlug,
        });
      } catch (e) {
        logSeoError("generateSeoPackWithAi", e, { pageSlug });
        bundle = buildTemplateSeoBundle({
          suburbName: row.suburb_name,
          postcode: row.postcode,
          state,
          regionName,
        });
      }

      const now = new Date().toISOString();
      const json = bundleToRowJson(bundle);

      const { error: upsertErr } = await admin.from("seo_content").upsert(
        {
          suburb_id: row.id,
          region_id: row.region_id,
          page_slug: pageSlug,
          ...json,
          meta_title: bundle.metaTitle,
          meta_description: bundle.metaDescription,
          last_error: null,
          last_checked_at: now,
          updated_at: now,
        } as never,
        { onConflict: "suburb_id" }
      );

      if (upsertErr) {
        logSeoError("seo_content upsert", upsertErr, { pageSlug });
        await admin
          .from("seo_suburbs")
          .update({ last_checked: now, notes: `seo_content: ${upsertErr.message}` } as never)
          .eq("id", row.id);
        continue;
      }

      await admin
        .from("seo_suburbs")
        .update({
          completed: true,
          completed_at: now,
          last_checked: now,
          notes: null,
        } as never)
        .eq("id", row.id);

      revalidatePath(`/bond-cleaning/${pageSlug}`);
      revalidatePath("/sitemap.xml");
      const pageUrl = `${siteOrigin}/bond-cleaning/${encodeURIComponent(pageSlug)}`;
      const extraUrls = bundle.blogPosts.map(
        (p) => `${pageUrl}#guide-${encodeURIComponent(p.slug)}`
      );
      generated.push({ suburbId: row.id, pageSlug, pageUrl, extraUrls });
      logSeoInfo("generated SEO pack", { pageSlug, suburbId: row.id });
    }

    revalidatePath("/admin/seo");

    if (generated.length === 0) {
      return { ok: false, error: "No suburbs were generated. Check suburb IDs and database." };
    }
    return { ok: true, generated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed.";
    logSeoError("generateSeoForSuburbs", e);
    return { ok: false, error: msg };
  }
}

/**
 * Validate generated JSON, strip unsafe markdown, merge template gaps.
 */
export async function checkAndFixSeo(
  suburbId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (no admin client)." };
    }

    const { data: sub, error: sErr } = await admin
      .from("seo_suburbs")
      .select("id, suburb_name, postcode, region_id, seo_regions (name, slug)")
      .eq("id", suburbId)
      .maybeSingle();

    if (sErr || !sub) {
      return { ok: false, error: "Suburb not found." };
    }

    const row = sub as {
      id: string;
      suburb_name: string;
      postcode: string;
      region_id: string;
      seo_regions: { name: string; slug: string } | { name: string; slug: string }[] | null;
    };
    const region = Array.isArray(row.seo_regions) ? row.seo_regions[0] : row.seo_regions;
    const regionName = region?.name ?? "Queensland";
    const regionSlug = region?.slug ?? "";
    const state = regionStateForSlug(regionSlug);

    const { data: content, error: cErr } = await admin
      .from("seo_content")
      .select("*")
      .eq("suburb_id", suburbId)
      .maybeSingle();

    const fallback = buildTemplateSeoBundle({
      suburbName: row.suburb_name,
      postcode: row.postcode,
      state,
      regionName,
    });

    if (cErr || !content) {
      const pageSlug = buildLocationSlug(row.suburb_name, state, row.postcode);
      const bundle = fallback;
      const now = new Date().toISOString();
      const json = bundleToRowJson(bundle);
      await admin.from("seo_content").upsert(
        {
          suburb_id: row.id,
          region_id: row.region_id,
          page_slug: pageSlug,
          ...json,
          meta_title: bundle.metaTitle,
          meta_description: bundle.metaDescription,
          last_error: null,
          last_checked_at: now,
          updated_at: now,
        } as never,
        { onConflict: "suburb_id" }
      );
      revalidatePath(`/bond-cleaning/${pageSlug}`);
      revalidatePath("/admin/seo");
      return { ok: true };
    }

    const raw = {
      landing: content.landing,
      blogPosts: content.blog_posts,
      faq: content.faq_schema,
      metaTitle: content.meta_title ?? fallback.metaTitle,
      metaDescription: content.meta_description ?? fallback.metaDescription,
    } as unknown;

    const normalized = normalizeBundle(raw, fallback);

    const fixMarkdown = (b: SeoGeneratedBundle): SeoGeneratedBundle => ({
      ...b,
      landing: {
        ...b.landing,
        sections: b.landing.sections.map((s) => ({
          ...s,
          bodyMarkdown: sanitizeMarkdown(s.bodyMarkdown),
        })),
      },
      blogPosts: b.blogPosts.map((p) => ({
        ...p,
        bodyMarkdown: sanitizeMarkdown(p.bodyMarkdown),
      })),
    });

    const fixed = fixMarkdown(normalized);
    const now = new Date().toISOString();
    const json = bundleToRowJson(fixed);

    await admin
      .from("seo_content")
      .update({
        ...json,
        meta_title: fixed.metaTitle,
        meta_description: fixed.metaDescription,
        last_error: null,
        last_checked_at: now,
        updated_at: now,
      } as never)
      .eq("suburb_id", suburbId);

    const pageSlug =
      (content as { page_slug?: string }).page_slug ??
      buildLocationSlug(row.suburb_name, state, row.postcode);
    revalidatePath(`/bond-cleaning/${pageSlug}`);
    revalidatePath("/admin/seo");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Check failed.";
    logSeoError("checkAndFixSeo", e);
    return { ok: false, error: msg };
  }
}

export async function resetSeoForSuburb(
  suburbId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (no admin client)." };
    }

    const { data: existing } = await admin
      .from("seo_content")
      .select("page_slug")
      .eq("suburb_id", suburbId)
      .maybeSingle();

    await admin.from("seo_content").delete().eq("suburb_id", suburbId);

    await admin
      .from("seo_suburbs")
      .update({
        completed: false,
        completed_at: null,
        last_checked: new Date().toISOString(),
        notes: null,
      } as never)
      .eq("id", suburbId);

    const slug = (existing as { page_slug?: string } | null)?.page_slug;
    if (slug) {
      revalidatePath(`/bond-cleaning/${slug}`);
    }
    revalidatePath("/admin/seo");
    revalidatePath("/sitemap.xml");
    logSeoInfo("resetSeoForSuburb", { suburbId });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reset failed.";
    logSeoError("resetSeoForSuburb", e);
    return { ok: false, error: msg };
  }
}

export async function resetSeoForRegion(
  regionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (no admin client)." };
    }

    const { data: suburbs } = await admin.from("seo_suburbs").select("id").eq("region_id", regionId);

    const ids = (suburbs ?? []).map((r) => (r as { id: string }).id);
    if (ids.length > 0) {
      await admin.from("seo_content").delete().in("suburb_id", ids);
    }

    await admin
      .from("seo_suburbs")
      .update({
        completed: false,
        completed_at: null,
        last_checked: new Date().toISOString(),
        notes: null,
      } as never)
      .eq("region_id", regionId);

    revalidatePath("/admin/seo");
    revalidatePath("/sitemap.xml");
    logSeoInfo("resetSeoForRegion", { regionId, suburbsCleared: ids.length });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reset failed.";
    logSeoError("resetSeoForRegion", e);
    return { ok: false, error: msg };
  }
}

export async function getSeoProgress(
  regionSlug: string
): Promise<SeoProgressResult | { ok: false; error: string }> {
  try {
    await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (no admin client)." };
    }

    const { data: region, error: rErr } = await admin
      .from("seo_regions")
      .select("id, name, slug")
      .eq("slug", regionSlug.trim().toLowerCase())
      .maybeSingle();

    if (rErr || !region) {
      return { ok: false, error: "Region not found." };
    }

    const reg = region as { id: string; name: string; slug: string };

    const { data: suburbs } = await admin
      .from("seo_suburbs")
      .select("id, suburb_name, slug, postcode, priority, completed, completed_at")
      .eq("region_id", reg.id)
      .order("priority", { ascending: true });

    const suburbRows = suburbs ?? [];
    const suburbIds = suburbRows.map((s) => (s as { id: string }).id);

    const contentBySuburb = new Map<string, { page_slug: string; last_error: string | null }>();
    if (suburbIds.length > 0) {
      const { data: contents } = await admin
        .from("seo_content")
        .select("suburb_id, page_slug, last_error")
        .in("suburb_id", suburbIds);
      for (const c of contents ?? []) {
        const row = c as { suburb_id: string; page_slug: string; last_error: string | null };
        contentBySuburb.set(row.suburb_id, { page_slug: row.page_slug, last_error: row.last_error });
      }
    }

    const list: SeoSuburbStatus[] = suburbRows.map((s) => {
      const row = s as {
        id: string;
        suburb_name: string;
        slug: string;
        postcode: string;
        priority: number;
        completed: boolean;
        completed_at: string | null;
      };
      const sc = contentBySuburb.get(row.id);
      return {
        id: row.id,
        suburbName: row.suburb_name,
        slug: row.slug,
        postcode: row.postcode,
        priority: row.priority,
        completed: row.completed,
        completedAt: row.completed_at,
        pageSlug: sc?.page_slug ?? null,
        lastError: sc?.last_error ?? null,
      };
    });

    const total = list.length;
    const completed = list.filter((x) => x.completed).length;
    const completionPct = total ? Math.round((completed / total) * 100) : 0;

    return {
      ok: true,
      regionSlug: reg.slug,
      regionName: reg.name,
      completionPct,
      total,
      completed,
      suburbs: list,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load progress.";
    return { ok: false, error: msg };
  }
}
