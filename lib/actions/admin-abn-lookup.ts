"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  fetchAbrAbnDetailsJson,
  flattenAbrPayloadForDisplay,
} from "@/lib/abr/abn-details-json";

export type AdminAbnLookupRow = { key: string; label: string; value: string };

export type AdminAbnLookupResult =
  | {
      ok: true;
      abnFormatted: string;
      rows: AdminAbnLookupRow[];
      rawJson: string;
    }
  | { ok: false; error: string };

function formatAbnDisplay(digits11: string): string {
  const d = digits11.replace(/\D/g, "");
  if (d.length !== 11) return digits11;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

async function requireAdminSession(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return { ok: false, error: "Admin access only." };
  }
  return { ok: true };
}

/**
 * Admin-only: full ABR AbnDetails payload for support / verification.
 * Uses the same ABR_GUID as site-wide ABN validation.
 */
export async function adminLookupAbnDetails(abnRaw: string): Promise<AdminAbnLookupResult> {
  const gate = await requireAdminSession();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const digits = (abnRaw ?? "").replace(/\D/g, "").trim();
  if (digits.length !== 11) {
    return { ok: false, error: "Enter exactly 11 digits (spaces are OK)." };
  }

  const fetched = await fetchAbrAbnDetailsJson(digits);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const rows = flattenAbrPayloadForDisplay(fetched.data);
  let rawJson: string;
  try {
    rawJson = JSON.stringify(fetched.data, null, 2);
  } catch {
    rawJson = String(fetched.data);
  }

  return {
    ok: true,
    abnFormatted: formatAbnDisplay(digits),
    rows,
    rawJson,
  };
}
