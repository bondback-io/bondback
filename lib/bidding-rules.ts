/**
 * Reverse-auction rules shared by server actions and the bid form UI.
 * A single bid may lower the price by at most this many cents from the current lowest ($100 AUD).
 */
export const MAX_BID_DROP_PER_BID_CENTS = 10000;

export type ParseBidDollarsResult =
  | { ok: true; cents: number }
  | { ok: false; message: string };

/**
 * Parse a user-entered dollar string into integer cents. Rejects more than one decimal point,
 * more than two fractional digits, or non-numeric junk (e.g. 250.50.321).
 */
export function parseBidDollarsStringToCents(raw: string): ParseBidDollarsResult {
  const s0 = raw.trim();
  if (!s0) {
    return { ok: false, message: "Enter a dollar amount." };
  }
  const dotCount = (s0.match(/\./g) ?? []).length;
  if (dotCount > 1) {
    return {
      ok: false,
      message: "Use only one decimal point (e.g. 250.50).",
    };
  }
  const s = s0.startsWith(".") ? `0${s0}` : s0;
  if (!/^\d+(?:\.\d*)?$/.test(s)) {
    return {
      ok: false,
      message: "Enter a valid amount using digits and at most one decimal point (e.g. 250.50).",
    };
  }
  const [, frac = ""] = s.split(".");
  if (frac.length > 2) {
    return {
      ok: false,
      message: "Use at most two decimal places (e.g. 250.50).",
    };
  }
  const dollars = Number.parseFloat(s);
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { ok: false, message: "Enter an amount greater than $0." };
  }
  const cents = Math.round(dollars * 100);
  if (cents < 1) {
    return { ok: false, message: "Enter an amount greater than $0." };
  }
  return { ok: true, cents };
}
