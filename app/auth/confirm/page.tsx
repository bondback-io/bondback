import { Suspense } from "react";
import { AuthConfirmClient, AuthConfirmFallback } from "./auth-confirm-client";

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<AuthConfirmFallback />}>
      <AuthConfirmClient />
    </Suspense>
  );
}
