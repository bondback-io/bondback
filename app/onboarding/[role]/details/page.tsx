import { redirect } from "next/navigation";
import { DetailsFormClient } from "@/components/onboarding/details-form-client";
import type { OnboardingRole } from "@/components/onboarding/onboarding-storage";

const VALID_ROLES: OnboardingRole[] = ["lister", "cleaner", "both"];

type PageProps = {
  params: Promise<{ role: string }>;
};

export default async function OnboardingDetailsPage({ params }: PageProps) {
  const { role } = await params;
  if (!VALID_ROLES.includes(role as OnboardingRole)) {
    redirect("/onboarding/role-choice");
  }

  return (
    <section className="page-inner flex min-h-[60vh] flex-col items-center justify-center">
      <DetailsFormClient role={role as OnboardingRole} />
    </section>
  );
}
