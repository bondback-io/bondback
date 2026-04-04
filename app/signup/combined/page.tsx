import { Suspense } from "react";
import { SignupPath2Wizard } from "@/components/signup/signup-path2-wizard";

export default function CombinedSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="page-inner flex min-h-[50vh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SignupPath2Wizard />
    </Suspense>
  );
}
