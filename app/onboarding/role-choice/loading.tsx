import { OnboardingRouteLoadingFallback } from "@/components/onboarding/onboarding-flow-progress-screen";

export default function RoleChoiceLoading() {
  return (
    <section className="page-inner flex min-h-[50vh] flex-col items-center justify-center">
      <OnboardingRouteLoadingFallback />
    </section>
  );
}
