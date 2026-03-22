"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

export async function adminForceEndListing(formData: FormData) {
  const listingId = formData.get("listingId");
  if (!listingId) return { ok: false, error: "Missing listingId" };
  const { supabase, adminId } = await requireAdmin();
  const { error } = await supabase
    .from("listings")
    .update({ status: "ended" } as never)
    .eq("id", listingId as never);
  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "listing_force_end", targetType: "listing", targetId: String(listingId), details: { status: "ended" } });

  revalidatePath("/admin/listings");
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
  return { ok: true };
}

export async function adminDeleteListing(formData: FormData) {
  const listingId = formData.get("listingId");
  if (!listingId) return { ok: false, error: "Missing listingId" };
  const id = String(listingId);
  const { supabase, adminId } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Admin delete requires SUPABASE_SERVICE_ROLE_KEY so listers see updates." };
  const db = admin;

  const { data: jobs } = await db.from("jobs").select("id").eq("listing_id", id);
  const jobIds = (jobs ?? []).map((j: { id: number }) => j.id);

  if (jobIds.length > 0) {
    await (db as any).from("job_checklist_items").delete().in("job_id", jobIds);
    await db.from("job_messages").delete().in("job_id", jobIds);
    await db.from("jobs").delete().in("id", jobIds);
  }

  await db.from("bids").delete().eq("listing_id", id);
  const { error } = await db.from("listings").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "listing_deleted", targetType: "listing", targetId: id, details: { cascadeJobs: jobIds } });

  revalidatePath("/admin/listings");
  revalidatePath("/dashboard");
  revalidatePath("/lister/dashboard");
  revalidatePath("/my-listings");
  return { ok: true };
}

export async function adminResetAllListings(formData: FormData) {
  const confirmed = formData.get("confirm") === "on";
  const double = formData.get("confirmText");
  if (!confirmed || (double as string)?.toLowerCase() !== "delete") {
    return { ok: false, error: "Confirmation required" };
  }
  const { supabase, adminId } = await requireAdmin();
  const { data: listings } = await supabase.from("listings").select("id");
  const ids = (listings ?? []).map((l: { id: string }) => l.id);
  for (const id of ids) {
    const fd = new FormData();
    fd.set("listingId", id);
    // eslint-disable-next-line no-await-in-loop
    await adminDeleteListing(fd);
  }
  await logAdminActivity({ adminId, actionType: "listings_reset_all", targetType: "listing", targetId: null, details: { count: ids.length } });
  return { ok: true };
}

