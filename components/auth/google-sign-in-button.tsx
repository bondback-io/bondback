"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getClientAuthRedirectOrigin } from "@/lib/auth/email-redirect-origin";
import { buildAuthCallbackUrl } from "@/lib/auth/oauth-callback-url";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type GoogleSignInButtonProps = {
  /** Post-login path passed to `/auth/callback` (default `/dashboard`). */
  nextPath?: string;
  referralCode?: string | null;
  className?: string;
  /** Sign up flow should use `/onboarding/role-choice` so new users pick a role. */
  variant?: "login" | "signup";
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5 shrink-0", className)} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  nextPath,
  referralCode,
  className,
  variant = "login",
}: GoogleSignInButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedNext =
    nextPath?.trim() ||
    (variant === "signup" ? "/onboarding/role-choice" : "/dashboard");

  const startGoogleOAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = buildAuthCallbackUrl(getClientAuthRedirectOrigin(), {
        next: resolvedNext,
        ref: referralCode,
      });
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          /** openid + email + profile → userinfo.email & userinfo.profile (given_name, family_name, picture). */
          scopes: "openid email profile",
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-border/80 bg-background font-medium"
        onClick={() => setDialogOpen(true)}
        disabled={loading}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setError(null);
            setLoading(false);
          }
          setDialogOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Continue with Google</DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              You’ll open Google’s sign-in page in this tab. To stay on Bond Back, tap Cancel below. If
              you’ve already gone to Google, use your browser’s back button to return here.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void startGoogleOAuth()} disabled={loading}>
              {loading ? "Opening Google…" : "Continue to Google"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
