import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RoleChoiceClient } from "@/components/onboarding/role-choice-client";

/**
 * Auth-only: user arrives after `/signup` (or `/dashboard` when `roles` is empty).
 * `?ref=` is still accepted on `/signup`; referral is applied in minimal profile upsert.
 */
export const metadata: Metadata = {
  title: "Choose your role",
  description:
    "Choose lister or cleaner to continue onboarding on Bond Back — bond cleaning and end of lease jobs.",
};

export default async function RoleChoicePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?next=/onboarding/role-choice");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", session.user.id)
    .maybeSingle();

  const raw = (profile as { roles?: unknown } | null)?.roles;
  let roles: string[] = [];
  if (Array.isArray(raw)) {
    roles = raw as string[];
  } else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) roles = p as string[];
    } catch {
      roles = [];
    }
  }

  if (roles.length > 0) {
    redirect("/dashboard");
  }

  return (
    <section className="page-inner flex min-h-[60vh] flex-col items-center justify-center">
      <Suspense
        fallback={
          <div className="text-muted-foreground dark:text-gray-400">Loading…</div>
        }
      >
        <RoleChoiceClient />
      </Suspense>
    </section>
  );
}
