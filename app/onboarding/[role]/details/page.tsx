import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DetailsFormClient } from "@/components/onboarding/details-form-client";
import type { OnboardingRole } from "@/components/onboarding/onboarding-storage";

const VALID_ROLES: OnboardingRole[] = ["lister", "cleaner", "both"];

type PageProps = {
  params: Promise<{ role: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { role } = await params;
  const label =
    role === "lister"
      ? "Lister details"
      : role === "cleaner"
        ? "Cleaner details"
        : role === "both"
          ? "Lister & cleaner details"
          : "Your details";
  return {
    title: label,
    description: `Add your ${role} details for Bond Back onboarding — bond cleaning marketplace.`,
  };
}

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
