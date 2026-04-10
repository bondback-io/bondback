import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSeoManager } from "@/components/admin/admin-seo-manager";
import { AdminSeoAutomationPanel } from "@/components/admin/admin-seo-automation-panel";
import { loadSeoManagerData } from "@/lib/seo/seo-manager-data";
import { loadSeoAutomationData } from "@/lib/seo/load-seo-automation-data";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "SEO Management",
  description: "Generate and manage local SEO content by region, plus technical SEO checklist.",
};

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

export default async function AdminSeoPage() {
  await requireAdmin();

  const payload = await loadSeoManagerData();
  const automation = await loadSeoAutomationData();

  return (
    <AdminShell activeHref="/admin/seo">
      <div className="space-y-6">
        <AdminSeoAutomationPanel regions={automation.regions} suburbs={automation.suburbs} />

        <Card className="border-border/80 bg-card/50 dark:border-gray-800 dark:bg-gray-900/40">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
              Technical SEO checklist
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-relaxed">
              Automated checks and manual confirmations for on-site SEO. Canonical domain:{" "}
              <strong className="text-foreground">www.bondback.io</strong>
            </CardDescription>
          </CardHeader>
        </Card>

        <AdminSeoManager auto={payload.auto} manual={payload.manual} />
      </div>
    </AdminShell>
  );
}
