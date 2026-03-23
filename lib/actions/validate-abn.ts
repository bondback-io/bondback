"use server";

import { getRequireAbnForValidation } from "@/lib/actions/global-settings";

/**
 * Validate an ABN against the Australian Business Register (ABR) web service.
 * Uses the JSON API with your registered GUID (set ABR_GUID in .env.local).
 *
 * @see https://abr.business.gov.au/json/
 * @see https://abr.business.gov.au/Documentation/WebServiceRegistration
 */

const ABR_JSON_URL = "https://abr.business.gov.au/json/AbnDetails.aspx";

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

  const guid = process.env.ABR_GUID ?? process.env.ABN_LOOKUP_GUID;
  if (!guid || !guid.trim()) {
    return { ok: false, error: "ABN lookup is not configured. Please try again later." };
  }

  const url = `${ABR_JSON_URL}?abn=${encodeURIComponent(digits)}&guid=${encodeURIComponent(guid.trim())}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    const text = await res.text();

    if (!res.ok) {
      return { ok: false, error: "ABN lookup service is temporarily unavailable." };
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const jsonpStart = text.indexOf("(");
      const jsonpEnd = text.lastIndexOf(")");
      if (jsonpStart !== -1 && jsonpEnd > jsonpStart) {
        try {
          data = JSON.parse(text.slice(jsonpStart + 1, jsonpEnd)) as Record<string, unknown>;
        } catch {
          return { ok: false, error: "ABN lookup could not be completed. Please try again." };
        }
      } else {
        return { ok: false, error: "ABN lookup could not be completed. Please try again." };
      }
    }

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
