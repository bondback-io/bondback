import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QuickSetupListerClient } from "@/components/onboarding/quick-setup-lister-client";
import { QuickSetupCleanerClient } from "@/components/onboarding/quick-setup-cleaner-client";

/**
 * ============================================================================
 * QUICK SETUP — role-specific step 2 of 2 (after `/onboarding/role-choice`)
 * ============================================================================
 *
 *   role-choice
 *        │
 *        ├── lister  ──► /onboarding/lister/quick-setup  ──► /listings/new or /lister/dashboard
 *        │
 *        └── cleaner ──► /onboarding/cleaner/quick-setup ──► /cleaner/dashboard
 *
 * Uses shadcn Card, Button size="lg", ProgressRing (circular).
 * ============================================================================
 */

type PageProps = {
  params: Promise<{ role: string }>;
};

export default async function QuickSetupPage({ params }: PageProps) {
  const { role } = await params;
  if (role !== "lister" && role !== "cleaner") {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?next=/onboarding/${role}/quick-setup`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", session.user.id)
    .maybeSingle();

  const roles = ((profile as { roles?: string[] | null } | null)?.roles as string[] | null) ?? [];
  if (role === "lister" && !roles.includes("lister")) {
    redirect("/onboarding/role-choice");
  }
  if (role === "cleaner" && !roles.includes("cleaner")) {
    redirect("/onboarding/role-choice");
  }

  return (
    <section className="page-inner flex min-h-[60vh] flex-col items-center">
      {role === "lister" ? <QuickSetupListerClient /> : <QuickSetupCleanerClient />}
    </section>
  );
}
