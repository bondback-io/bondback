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
 * Prominent on mobile: dark backdrop, large type, 30s auto-dismiss or manual close.
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
        <DialogOverlay className="z-[100] bg-black/80 backdrop-blur-[4px] dark:bg-black/90" />
        <DialogPrimitive.Content
          aria-describedby="registration-check-email-desc"
          className={cn(
            "fixed left-1/2 top-1/2 z-[101] grid w-[min(100vw-1rem,26rem)] max-w-[min(100vw-1rem,26rem)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl border-2 border-border/90 bg-card p-7 pb-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] duration-200 sm:w-full sm:max-w-lg sm:gap-6 sm:p-9",
            "dark:border-gray-600 dark:bg-gray-950 dark:text-gray-50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "focus:outline-none"
          )}
        >
          <div className="flex justify-center pt-0.5">
            <span className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl bg-primary/15 text-primary dark:bg-sky-500/20 dark:text-sky-300">
              <Mail className="h-9 w-9" aria-hidden />
            </span>
          </div>

          <div className="space-y-3 text-center sm:space-y-4">
            <DialogPrimitive.Title className="text-balance text-[1.65rem] font-bold leading-tight tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
              Almost there!{" "}
              <span className="inline-block align-middle" aria-hidden>
                ✅
              </span>
            </DialogPrimitive.Title>
            <p
              id="registration-check-email-desc"
              className="text-balance text-lg font-medium leading-relaxed text-foreground/90 dark:text-gray-200 sm:text-xl"
            >
              Please check your email to confirm your account.
            </p>
            {email ? (
              <p className="break-all text-base font-semibold leading-snug text-foreground dark:text-gray-100">
                Sent to: {email}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              This message closes automatically in 30 seconds, or use Got it below.
            </p>
          </div>

          <Button
            type="button"
            className="min-h-[3.25rem] w-full text-lg font-semibold shadow-md sm:min-h-14"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>

          <div className="space-y-3">
            <p className="rounded-xl bg-muted/60 px-4 py-3.5 text-center text-base leading-relaxed text-muted-foreground dark:bg-gray-900/80 dark:text-gray-400">
              Check your spam or promotions folder if you don&apos;t see it.
            </p>

            <Button
              type="button"
              variant="outline"
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 text-base sm:min-h-14 sm:text-lg"
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
              className="text-center text-base font-medium text-foreground dark:text-gray-200"
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
