import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPromoToolsPanel } from "@/components/admin/admin-promo-tools-panel";

export const metadata: Metadata = {
  title: "Promo tools",
  description: "Super-admin tools for the 0% launch promo.",
  robots: { index: false, follow: false },
};

export default async function AdminPromoToolsPage() {
  const session = await getSessionWithProfile();
  if (!session?.isAdmin) {
    redirect("/dashboard");
  }
  if (!session.isSuperAdmin) {
    redirect("/admin/dashboard");
  }

  return (
    <AdminShell activeHref="/admin/promo-tools">
      <div className="page-inner max-w-4xl space-y-6">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground dark:text-gray-100">
            <Sparkles className="h-7 w-7 text-amber-500" aria-hidden />
            Promo tools
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Inspect and reset per-user promo counters; adjust or end the site-wide promo window for
            QA. Grant access with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs dark:bg-gray-800">
              profiles.is_super_admin = true
            </code>{" "}
            (requires{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs dark:bg-gray-800">is_admin</code>
            ).
          </p>
        </div>
        <AdminPromoToolsPanel />
      </div>
    </AdminShell>
  );
}
