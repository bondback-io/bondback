"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { SeoTaskKey } from "@/lib/seo/seo-checklist-config";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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
  if (!profile?.is_admin) {
    throw new Error("Admin access required.");
  }
  return session.user.id;
}

export async function saveSeoManualTask(input: {
  taskKey: SeoTaskKey;
  completed: boolean;
  notes: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireAdminUserId();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error (no admin client)." };
    }
    const now = new Date().toISOString();
    const { error } = await admin.from("seo_manual_checklist").upsert(
      {
        task_key: input.taskKey,
        completed_at: input.completed ? now : null,
        notes: input.notes.trim() ? input.notes.trim() : null,
        updated_at: now,
        updated_by: userId,
      } as never,
      { onConflict: "task_key" }
    );
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/admin/seo");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save.";
    return { ok: false, error: msg };
  }
}
