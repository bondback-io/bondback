"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEmailForUserId } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { getSiteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/notifications/email";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const SEO_GSC_TASK_KEY = "gsc_url_submission" as const;

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

export async function getSeoManualTaskState(
  regionSlug: string
): Promise<{ ok: true; gscSubmittedAt: string | null } | { ok: false; error: string }> {
  try {
    const userId = await requireAdminUserId();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("seo_manual_task_state")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("region_slug", regionSlug.trim().toLowerCase())
      .eq("task_key", SEO_GSC_TASK_KEY)
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }
    const row = data as { completed_at: string } | null;
    return { ok: true, gscSubmittedAt: row?.completed_at ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load task state.";
    return { ok: false, error: msg };
  }
}

export async function setSeoGscSubmitted(input: {
  regionSlug: string;
  completed: boolean;
}): Promise<{ ok: true; completedAt: string | null } | { ok: false; error: string }> {
  try {
    const userId = await requireAdminUserId();
    const supabase = await createServerSupabaseClient();
    const slug = input.regionSlug.trim().toLowerCase();

    if (!input.completed) {
      const { error } = await supabase
        .from("seo_manual_task_state")
        .delete()
        .eq("user_id", userId)
        .eq("region_slug", slug)
        .eq("task_key", SEO_GSC_TASK_KEY);

      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath("/admin/seo");
      return { ok: true, completedAt: null };
    }

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("seo_manual_task_state")
      .select("user_id")
      .eq("user_id", userId)
      .eq("region_slug", slug)
      .eq("task_key", SEO_GSC_TASK_KEY)
      .maybeSingle();

    const row = {
      user_id: userId,
      region_slug: slug,
      task_key: SEO_GSC_TASK_KEY,
      completed_at: now,
    };

    const { error } = existing
      ? await supabase
          .from("seo_manual_task_state")
          .update({ completed_at: now } as never)
          .eq("user_id", userId)
          .eq("region_slug", slug)
          .eq("task_key", SEO_GSC_TASK_KEY)
      : await supabase.from("seo_manual_task_state").insert(row as never);

    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/admin/seo");
    return { ok: true, completedAt: now };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save.";
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendSeoGscUrlEmail(input: {
  regionSlug: string;
  regionName: string;
  urls: string[];
}): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  try {
    const userId = await requireAdminUserId();
    const email = await getEmailForUserId(userId);
    if (!email) {
      return { ok: false, error: "Could not resolve your account email." };
    }

    const site = getSiteUrl();
    const adminSeoUrl = `${site.origin}/admin/seo`;
    const sitemapUrl = `${site.origin}/sitemap.xml`;
    const subject = `New SEO Pages Ready for Google Search Console - ${input.regionName}`;

    const urlLines = input.urls.filter(Boolean);
    const listHtml = urlLines.length
      ? `<ul style="margin:12px 0;padding-left:20px;">${urlLines.map((u) => `<li style="margin:6px 0;"><a href="${escapeHtml(u)}">${escapeHtml(u)}</a></li>`).join("")}</ul>`
      : "<p><em>No URLs were included in this message.</em></p>";

    const textList = urlLines.length ? urlLines.join("\n") : "(none)";

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;margin:0 0 16px;">New SEO pages — ${escapeHtml(input.regionName)}</h1>
  <p style="margin:0 0 16px;">Use the URLs below in <strong>Google Search Console</strong> (URL Inspection → request indexing), and submit your updated sitemap.</p>
  ${listHtml}
  <h2 style="font-size:16px;margin:24px 0 8px;">Steps</h2>
  <ol style="margin:0;padding-left:20px;">
    <li style="margin:8px 0;">Log into <a href="https://search.google.com/search-console">Google Search Console</a>.</li>
    <li style="margin:8px 0;">Open <strong>URL Inspection</strong>, paste each URL below (one per line in the tool), and click <strong>Request indexing</strong>.</li>
    <li style="margin:8px 0;">Submit or refresh your sitemap: <a href="${escapeHtml(sitemapUrl)}">${escapeHtml(sitemapUrl)}</a></li>
  </ol>
  <p style="margin:24px 0 8px;font-size:14px;color:#6b7280;">Plain list (copy for bulk tools):</p>
  <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap;">${escapeHtml(textList)}</pre>
  <p style="margin:24px 0 0;">
    <a href="${escapeHtml(adminSeoUrl)}" style="color:#059669;font-weight:600;">Open Bond Back Admin — SEO Management</a>
  </p>
  <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Bond Back · This message was sent because you requested it from the SEO dashboard.</p>
</body>
</html>`;

    const res = await sendEmail(email, subject, html, {
      log: { userId, kind: "seo_gsc_url_list" },
    });

    if (!res.ok && !res.skipped) {
      return { ok: false, error: res.error ?? "Email failed." };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send email.";
    return { ok: false, error: msg };
  }
}
