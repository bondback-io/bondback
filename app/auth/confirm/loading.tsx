import { AuthEmailConfirmTransitionLoader } from "@/components/onboarding/auth-email-confirm-transition-loader";

export default function AuthConfirmLoading() {
  return <AuthEmailConfirmTransitionLoader variant="full" mode="linkConfirm" phaseLabel="Loading…" />;
}
