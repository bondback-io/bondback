import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminAbnCheckerClient } from "@/components/admin/admin-abn-checker-client";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as Pick<ProfileRow, "id" | "is_admin"> | null;
  if (!profile || !profile.is_admin) {
    redirect("/dashboard");
  }

  return { profile };
}

export default async function AdminAbnCheckerPage() {
  await requireAdmin();

  return (
    <AdminShell activeHref="/admin/abn-checker">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-100">
          ABN checker
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Look up any ABN against the Australian Business Register. Data is updated regularly by the
          ABR; use for verification support only.
        </p>
      </div>
      <AdminAbnCheckerClient />
    </AdminShell>
  );
}
