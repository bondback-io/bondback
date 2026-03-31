"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const AUTO_CLOSE_MS = 30_000;

type RegistrationCheckEmailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Email the user registered with (for display + resend). */
  email: string;
  /** Must match `signUp` / `resend` `emailRedirectTo` (full URL to `/auth/confirm` + query). */
  emailRedirectTo: string;
};

/**
 * Post-signup feedback when email confirmation is required (no instant session).
 * Mobile-first: dark backdrop, large type, primary “Got it”, optional resend, 30s auto-dismiss.
 */
export function RegistrationCheckEmailModal({
  open,
  onOpenChange,
  email,
  emailRedirectTo,
}: RegistrationCheckEmailModalProps) {
  const [resending, setResending] = useState(false);
  const [resendHint, setResendHint] = useState<string | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoClose = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      clearAutoClose();
      setResendHint(null);
      return;
    }
    autoCloseRef.current = setTimeout(() => {
      autoCloseRef.current = null;
      onOpenChange(false);
    }, AUTO_CLOSE_MS);
    return () => clearAutoClose();
  }, [open, onOpenChange, clearAutoClose]);

  const handleResend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setResendHint(null);
    setResending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setResendHint(error.message);
      } else {
        setResendHint("We sent another confirmation email.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay className="bg-black/75 backdrop-blur-[3px] dark:bg-black/85" />
        <DialogPrimitive.Content
          aria-describedby="registration-check-email-desc"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-[min(100vw-1.5rem,24rem)] max-w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-2xl border border-border/80 bg-card p-6 pb-7 shadow-2xl duration-200 sm:w-full sm:max-w-md sm:p-8",
            "dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "focus:outline-none"
          )}
        >
          <div className="flex justify-center pt-1">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20 dark:bg-sky-500/12 dark:text-sky-300 dark:ring-sky-500/25">
              <Mail className="h-8 w-8" aria-hidden />
            </span>
          </div>

          <div className="space-y-4 text-center">
            <DialogPrimitive.Title className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground dark:text-gray-50 sm:text-[1.75rem]">
              Almost there!{" "}
              <span className="inline-block align-middle" aria-hidden>
                ✅
              </span>
            </DialogPrimitive.Title>
            <p
              id="registration-check-email-desc"
              className="text-balance text-base leading-relaxed text-muted-foreground dark:text-gray-300 sm:text-lg"
            >
              Please check your email to confirm your account.
            </p>
            {email ? (
              <p className="break-all text-sm font-medium leading-snug text-foreground/90 dark:text-gray-200">
                Sent to: {email}
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            className="min-h-14 w-full text-base font-semibold shadow-sm"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>

          <div className="space-y-3">
            <p className="rounded-xl bg-muted/50 px-4 py-3 text-center text-sm leading-relaxed text-muted-foreground dark:bg-gray-900/70 dark:text-gray-400">
              Check your spam or promotions folder if you don&apos;t see it.
            </p>

            <Button
              type="button"
              variant="outline"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 text-base"
              size="lg"
              disabled={resending || !email.trim()}
              onClick={() => void handleResend()}
            >
              {resending ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Resend email"
              )}
            </Button>
          </div>

          {resendHint ? (
            <p
              role="status"
              className="text-center text-sm font-medium text-foreground dark:text-gray-200"
            >
              {resendHint}
            </p>
          ) : null}

          <DialogPrimitive.Close
            type="button"
            className="absolute right-2 top-2 flex min-h-12 min-w-12 items-center justify-center rounded-full text-muted-foreground ring-offset-background transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <span className="text-2xl leading-none" aria-hidden>
              ×
            </span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
