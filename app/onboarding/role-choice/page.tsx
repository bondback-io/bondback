import { Suspense } from "react";
import { RoleChoiceClient } from "@/components/onboarding/role-choice-client";

/**
 * Public page (no auth). User chooses role first, then goes to details form, then signup.
 * `?ref=CODE` stores a referral code for signup (see onboarding-storage).
 */
export default function RoleChoicePage() {
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
