/**
 * Australian Business Register (ABR) JSON endpoint for ABN details.
 * @see https://abr.business.gov.au/json/
 * Requires ABR_GUID or ABN_LOOKUP_GUID in env (same as profile validation).
 */

const ABR_JSON_URL = "https://abr.business.gov.au/json/AbnDetails.aspx";

export type AbrAbnFetchResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Fetch raw ABN details JSON from ABR (no auth check — callers must enforce admin / limits).
 */
export async function fetchAbrAbnDetailsJson(digits11: string): Promise<AbrAbnFetchResult> {
  const guid = process.env.ABR_GUID ?? process.env.ABN_LOOKUP_GUID;
  if (!guid || !guid.trim()) {
    return { ok: false, error: "ABR_GUID / ABN_LOOKUP_GUID is not configured on the server." };
  }

  const url = `${ABR_JSON_URL}?abn=${encodeURIComponent(digits11)}&guid=${encodeURIComponent(guid.trim())}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    const text = await res.text();

    if (!res.ok) {
      return { ok: false, error: "ABN lookup service returned an error. Try again later." };
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
          return { ok: false, error: "Could not parse ABR response." };
        }
      } else {
        return { ok: false, error: "Could not parse ABR response." };
      }
    }

    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (process.env.NODE_ENV !== "production") {
      console.error("[fetchAbrAbnDetailsJson]", msg);
    }
    return { ok: false, error: "ABN lookup failed. Check the number and try again." };
  }
}

function formatLeafValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.trim() === "" ? "—" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Human-readable labels for common flat ABR JSON keys (AbnDetails.aspx).
 * Unmapped keys still appear with their API field name.
 */
const KNOWN_LABELS: Record<string, string> = {
  Abn: "ABN",
  AbnStatus: "ABN status",
  AbnStatusEffectiveFrom: "ABN status effective from",
  Acn: "ACN",
  AddressDate: "Address date",
  AddressPostcode: "Address postcode",
  AddressState: "Address state",
  BusinessName: "Business name(s)",
  EntityName: "Entity name",
  EntityTypeCode: "Entity type code",
  EntityTypeName: "Entity type",
  Gst: "GST registration from",
  Message: "Message / notes",
  Exception: "Exception",
  ExceptionDescription: "Exception description",
  Rbn: "RBN",
  LastUpdated: "Last updated",
};

/**
 * Flatten nested objects/arrays from ABR JSON into rows for admin tables.
 */
export function flattenAbrPayloadForDisplay(data: Record<string, unknown>): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];

  function walk(node: unknown, path: string): void {
    if (node === null || node === undefined) {
      rows.push({
        key: path,
        label: labelForPath(path),
        value: "—",
      });
      return;
    }
    if (typeof node !== "object") {
      rows.push({ key: path, label: labelForPath(path), value: formatLeafValue(node) });
      return;
    }
    if (Array.isArray(node)) {
      if (node.length === 0) {
        rows.push({ key: path, label: labelForPath(path), value: "(none)" });
        return;
      }
      const allPrimitive = node.every(
        (x) => x === null || x === undefined || (typeof x !== "object" && typeof x !== "function")
      );
      if (allPrimitive) {
        rows.push({
          key: path,
          label: labelForPath(path),
          value: node.map((x) => formatLeafValue(x)).join(", "),
        });
        return;
      }
      node.forEach((item, i) => {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          walk(item, path ? `${path}[${i}]` : `[${i}]`);
        } else {
          walk(item, path ? `${path}[${i}]` : `[${i}]`);
        }
      });
      return;
    }
    const o = node as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) {
      rows.push({ key: path, label: labelForPath(path), value: "{}" });
      return;
    }
    for (const k of keys) {
      const next = path ? `${path}.${k}` : k;
      const v = o[k];
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        walk(v, next);
      } else if (Array.isArray(v)) {
        walk(v, next);
      } else {
        rows.push({ key: next, label: labelForPath(next), value: formatLeafValue(v) });
      }
    }
  }

  walk(data, "");
  return rows;
}

function labelForPath(path: string): string {
  if (!path) return "(root)";
  const segments = path.split(".");
  const lastSeg = segments[segments.length - 1] ?? path;
  const leafKey = lastSeg.replace(/\[\d+\]/g, "");
  if (segments.length === 1 && !path.includes("[")) {
    return KNOWN_LABELS[leafKey] ?? humanizeKey(leafKey);
  }
  return KNOWN_LABELS[leafKey] ?? `${path.replace(/\./g, " → ")}`;
}

function humanizeKey(k: string): string {
  return k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}
