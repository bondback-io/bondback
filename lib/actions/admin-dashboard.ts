"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logAdminActivity } from "@/lib/admin-activity-log";

async function requireAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  adminId: string;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile || !(profile as { is_admin?: boolean }).is_admin) throw new Error("Not authorised");
  return { supabase, adminId: session.user.id };
}

export type DeleteListingsResult = { ok: true; deleted: number } | { ok: false; error: string };

/**
 * Permanently delete listings by status. Ensures database is backed up before proceeding.
 * Deletes related jobs and bids first to satisfy FKs.
 */
export async function adminDeleteListingsByStatus(
  status: "live" | "ended" | "all"
): Promise<DeleteListingsResult> {
  const { supabase, adminId } = await requireAdmin();
  const statusFilter = status === "all" ? undefined : status;
  const query = statusFilter
    ? supabase.from("listings").select("id").eq("status", statusFilter)
    : supabase.from("listings").select("id");
  const { data: listings, error: fetchErr } = await query;

  if (fetchErr) return { ok: false, error: fetchErr.message };
  const ids = (listings ?? []).map((l: { id: string }) => l.id);
  if (ids.length === 0) return { ok: true, deleted: 0 };

  const { data: jobs } = await supabase.from("jobs").select("id").in("listing_id", ids);
  const jobIds = (jobs ?? []).map((j: { id: number }) => j.id);

  if (jobIds.length > 0) {
    await supabase.from("job_messages").delete().in("job_id", jobIds);
    await supabase.from("jobs").delete().in("listing_id", ids);
  }
  await supabase.from("bids").delete().in("listing_id", ids);
  const { error: deleteErr } = await supabase
    .from("listings")
    .delete()
    .in("id", ids);

  if (deleteErr) return { ok: false, error: deleteErr.message };
  await logAdminActivity({ adminId, actionType: "listings_deleted_by_status", targetType: "listing", targetId: null, details: { status, count: ids.length } });
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin");
  return { ok: true, deleted: ids.length };
}

export type ExportCsvResult = { ok: true; data: string; filename: string } | { ok: false; error: string };

/** Export table as CSV (listings, jobs, or users). */
export async function adminExportCsv(
  type: "listings" | "jobs" | "users"
): Promise<ExportCsvResult> {
  const { supabase } = await requireAdmin();

  if (type === "listings") {
    const { data, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as Record<string, unknown>[];
    const csv = rowsToCsv(rows);
    return { ok: true, data: csv, filename: `listings-${dateSuffix()}.csv` };
  }

  if (type === "jobs") {
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as Record<string, unknown>[];
    const csv = rowsToCsv(rows);
    return { ok: true, data: csv, filename: `jobs-${dateSuffix()}.csv` };
  }

  if (type === "users") {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as Record<string, unknown>[];
    const csv = rowsToCsv(rows);
    return { ok: true, data: csv, filename: `users-${dateSuffix()}.csv` };
  }

  return { ok: false, error: "Invalid export type" };
}

function dateSuffix() {
  return new Date().toISOString().slice(0, 10);
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.map((k) => escapeCsv(k)).join(",");
  const lines = rows.map((r) =>
    keys.map((k) => escapeCsv(String(r[k] ?? ""))).join(",")
  );
  return [header, ...lines].join("\n");
}

function escapeCsv(val: string): string {
  if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

/** Stub: Download database backup (CLI or Management API). */
export async function adminBackupStub(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireAdmin();
  return {
    ok: true,
    message: "Backup is not implemented in-app. Use Supabase Dashboard > Database > Backups, or run: pg_dump ...",
  };
}
