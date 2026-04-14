"use server";

import { getRequireAbnForValidation } from "@/lib/actions/global-settings";
import { fetchAbrAbnDetailsJson } from "@/lib/abr/abn-details-json";

/**
 * Validate an ABN against the Australian Business Register (ABR) web service.
 * Uses the JSON API with your registered GUID (set ABR_GUID in .env.local).
 *
 * @see https://abr.business.gov.au/json/
 * @see https://abr.business.gov.au/Documentation/WebServiceRegistration
 */

export type ValidateAbnResult =
  | { ok: true; entityName?: string }
  | { ok: false; error: string };

/**
 * Validate ABN: when Admin > Global Settings "Validate ABN with ABR" is ON, calls the
 * Australian Business Register. When OFF, only checks 11-digit format.
 * Use this everywhere ABN is collected (signup, onboarding, settings, profile).
 */
export async function validateAbnIfRequired(abn: string): Promise<ValidateAbnResult> {
  const digits = (abn ?? "").replace(/\D/g, "").trim();
  if (digits.length !== 11) {
    return { ok: false, error: "ABN must be 11 digits." };
  }

  const forceAbr = await getRequireAbnForValidation();

  if (!forceAbr) {
    return { ok: true };
  }

  return validateAbnWithAbr(abn);
}

export async function validateAbnWithAbr(abn: string): Promise<ValidateAbnResult> {
  const digits = (abn ?? "").replace(/\D/g, "").trim();
  if (digits.length !== 11) {
    return { ok: false, error: "ABN must be 11 digits." };
  }

  const fetched = await fetchAbrAbnDetailsJson(digits);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }
  const data = fetched.data;

  try {
    const message = typeof data.Message === "string" ? data.Message : "";
    if (message && /no records found|invalid|not recognised|error/i.test(message)) {
      return { ok: false, error: "This ABN was not found or is not active on the Australian Business Register." };
    }

    const abnStatus = typeof data.AbnStatus === "string" ? data.AbnStatus : "";
    if (abnStatus && abnStatus.toLowerCase() !== "active") {
      return { ok: false, error: "This ABN is not currently active on the Australian Business Register." };
    }

    const returnedAbn = typeof data.Abn === "string" ? data.Abn : "";
    if (!returnedAbn || returnedAbn.replace(/\D/g, "") !== digits) {
      return { ok: false, error: "This ABN was not found on the Australian Business Register." };
    }

    const entityName = typeof data.EntityName === "string" ? data.EntityName : undefined;
    return { ok: true, entityName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (process.env.NODE_ENV !== "production") {
      console.error("[validateAbnWithAbr]", msg);
    }
    return { ok: false, error: "ABN lookup failed. Please check the number and try again." };
  }
}

