"use client";

import { useEffect, useMemo, useState } from "react";
import { validateAbnIfRequired } from "@/lib/actions/validate-abn";

export type AbnLiveValidationState = {
  status: "idle" | "valid" | "invalid";
  /** Business / entity name from ABR when lookup ran successfully */
  entityName?: string;
  error?: string;
  validating: boolean;
};

const DEBOUNCE_MS = 450;

/**
 * When `abnRaw` has 11 digits, debounces and runs `validateAbnIfRequired`.
 * Shows valid (green tick) for format-only or ABR success; entity name only when ABR returns it.
 */
export function useAbnLiveValidation(abnRaw: string): AbnLiveValidationState {
  const digits = useMemo(() => abnRaw.replace(/\D/g, "").slice(0, 11), [abnRaw]);

  const [state, setState] = useState<AbnLiveValidationState>({
    status: "idle",
    validating: false,
  });

  useEffect(() => {
    if (digits.length !== 11) {
      setState({ status: "idle", validating: false });
      return;
    }

    let cancelled = false;
    setState({ status: "idle", validating: true });

    const t = setTimeout(async () => {
      const result = await validateAbnIfRequired(digits);
      if (cancelled) return;
      if (result.ok) {
        setState({
          status: "valid",
          entityName: result.entityName,
          validating: false,
        });
      } else {
        setState({
          status: "invalid",
          error: result.error,
          validating: false,
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [digits]);

  return state;
}
