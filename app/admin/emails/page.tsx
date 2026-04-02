import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminEmailTemplates } from "@/components/admin/admin-email-templates";
import { getEmailTemplates } from "@/lib/actions/admin-email-templates";

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
    .select("id, full_name, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  if (!profile || !profile.is_admin) {
    redirect("/dashboard");
  }

  return { profile };
}

export default async function AdminEmailsPage() {
  await requireAdmin();
  const initial = await getEmailTemplates();

  return (
    <AdminShell activeHref="/admin/emails">
      <div className="space-y-4 md:space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl dark:text-gray-100">
            Email templates & toggles
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
            Configure global email on/off, per-type toggles, and override subject/body per notification type.
          </p>
        </div>
        <AdminEmailTemplates initial={initial} />
      </div>
    </AdminShell>
  );
}
