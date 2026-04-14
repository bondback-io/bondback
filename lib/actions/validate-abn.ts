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
  | { ok: true; entityName?: string; details?: AbnValidationDetails }
  | { ok: false; error: string; details?: AbnValidationDetails };

export type AbnValidationDetails = {
  entityName?: string;
  businessName?: string;
  suburb?: string;
  state?: string;
  abnStatus?: string;
  isActive?: boolean;
};

function firstNonEmptyString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function readByLikelyKeys(
  node: unknown,
  keyMatcher: (k: string) => boolean
): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const stack: unknown[] = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
      continue;
    }
    for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
      const norm = k.toLowerCase();
      if (keyMatcher(norm)) {
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number") return String(v);
      }
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return undefined;
}

function parseBusinessName(data: Record<string, unknown>): string | undefined {
  const raw = data.BusinessName;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    const first = raw.find((x) => typeof x === "string" && x.trim());
    if (typeof first === "string") return first.trim();
    for (const item of raw) {
      if (item && typeof item === "object") {
        const byName = firstNonEmptyString(
          (item as Record<string, unknown>).OrganisationName,
          (item as Record<string, unknown>).BusinessName,
          (item as Record<string, unknown>).Name
        );
        if (byName) return byName;
      }
    }
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return firstNonEmptyString(obj.OrganisationName, obj.BusinessName, obj.Name);
  }
  return readByLikelyKeys(data, (k) => k.includes("businessname") || k.includes("organisationname"));
}

function parseAbnDetails(data: Record<string, unknown>): AbnValidationDetails {
  const entityName = firstNonEmptyString(data.EntityName);
  const businessName = parseBusinessName(data);
  const suburb = firstNonEmptyString(
    data.AddressSuburb,
    data.Suburb,
    readByLikelyKeys(data, (k) => k.includes("suburb") || k.includes("locality") || k.includes("town") || k.includes("city"))
  );
  const state = firstNonEmptyString(
    data.AddressState,
    data.State,
    readByLikelyKeys(data, (k) => k === "state" || k.includes("statecode") || k.includes("addressstate"))
  );
  const abnStatus = firstNonEmptyString(data.AbnStatus, data.Abnstatus);
  const isActive = typeof abnStatus === "string" ? abnStatus.toLowerCase() === "active" : undefined;
  return { entityName, businessName, suburb, state, abnStatus, isActive };
}

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

    const details = parseAbnDetails(data);
    const abnStatus = details.abnStatus ?? "";
    if (abnStatus && abnStatus.toLowerCase() !== "active") {
      return {
        ok: false,
        error: "This ABN is not currently active on the Australian Business Register.",
        details,
      };
    }

    const returnedAbn = typeof data.Abn === "string" ? data.Abn : "";
    if (!returnedAbn || returnedAbn.replace(/\D/g, "") !== digits) {
      return { ok: false, error: "This ABN was not found on the Australian Business Register." };
    }

    return { ok: true, entityName: details.entityName, details };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (process.env.NODE_ENV !== "production") {
      console.error("[validateAbnWithAbr]", msg);
    }
    return { ok: false, error: "ABN lookup failed. Please check the number and try again." };
  }
}

