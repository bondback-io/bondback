import { Suspense } from "react";
import { SignupPath2Wizard } from "@/components/signup/signup-path2-wizard";
import { SignupWizardSkeleton } from "@/components/skeletons/signup-wizard-skeleton";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupWizardSkeleton />}>
      <SignupPath2Wizard />
    </Suspense>
  );
}

