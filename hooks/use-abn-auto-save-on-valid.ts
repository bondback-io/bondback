"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { updateProfile } from "@/lib/actions/profile";
import type { AbnLiveValidationState } from "@/hooks/use-abn-live-validation";

type UseAbnAutoSaveOnValidOptions = {
  /** When false, does nothing (e.g. not cleaner context). */
  enabled: boolean;
  /** Current ABN field value (digits allowed mixed). */
  abnRaw: string;
  validation: AbnLiveValidationState;
  /** ABN already stored on the profile (skip save if unchanged). */
  storedAbn: string | null | undefined;
};

/**
 * Persists ABN via `updateProfile` when live validation reports success and the value
 * differs from the server. Then `router.refresh()` so server components see the new ABN.
 */
export function useAbnAutoSaveOnValid({
  enabled,
  abnRaw,
  validation,
  storedAbn,
}: UseAbnAutoSaveOnValidOptions) {
  const router = useRouter();
  const { toast } = useToast();
  const savingRef = useRef(false);
  /** Avoid duplicate POSTs while props are stale until `router.refresh()` completes. */
  const pendingPersistRef = useRef<string | null>(null);

  const digits = abnRaw.replace(/\D/g, "").slice(0, 11);
  const status = validation.status;
  const validating = validation.validating;
  const stored = (storedAbn ?? "").replace(/\D/g, "");

  useEffect(() => {
    if (!enabled) return;
    if (digits.length !== 11) {
      pendingPersistRef.current = null;
      return;
    }
    if (validating || status !== "valid") return;
    if (digits === stored) {
      pendingPersistRef.current = null;
      return;
    }
    if (pendingPersistRef.current === digits) return;
    if (savingRef.current) return;

    savingRef.current = true;
    pendingPersistRef.current = digits;
    void (async () => {
      try {
        const result = await updateProfile({ abn: digits });
        if (!result.ok) {
          pendingPersistRef.current = null;
          toast({
            variant: "destructive",
            title: "Couldn’t save ABN",
            description: result.error,
          });
          return;
        }
        toast({
          title: "ABN saved",
          description: "Your profile has been updated.",
        });
        router.refresh();
      } finally {
        savingRef.current = false;
      }
    })();
  }, [enabled, digits, validating, status, stored, router, toast]);
}
