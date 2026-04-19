import type { Json } from "@/types/supabase";

/** One additional escrow hold (separate Stripe PaymentIntent from the initial job payment). */
export type JobTopUpPaymentRecord = {
  payment_intent_id: string;
  agreed_cents: number;
  fee_cents: number;
  note: string | null;
  created_at: string;
  /** Set when funds are released to the cleaner for this leg. */
  stripe_transfer_id?: string | null;
};

export function parseJobTopUpPayments(raw: Json | null | undefined): JobTopUpPaymentRecord[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: JobTopUpPaymentRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const pi = String(o.payment_intent_id ?? "").trim();
    const agreed = Number(o.agreed_cents);
    const fee = Number(o.fee_cents);
    if (!pi || !Number.isFinite(agreed) || agreed < 1) continue;
    out.push({
      payment_intent_id: pi,
      agreed_cents: Math.floor(agreed),
      fee_cents: Number.isFinite(fee) ? Math.floor(fee) : 0,
      note: o.note != null ? String(o.note).slice(0, 2000) : null,
      created_at: String(o.created_at ?? new Date().toISOString()),
      stripe_transfer_id:
        o.stripe_transfer_id != null ? String(o.stripe_transfer_id).trim() || null : null,
    });
  }
  return out;
}

export type EscrowReleaseLeg = {
  paymentIntentId: string;
  agreedCents: number;
  /** Index in top_up_payments, or -1 for primary PI. */
  topUpIndex: number;
};

/**
 * Primary PaymentIntent pays `totalAgreed - sum(top-ups)` to the cleaner; each top-up PI pays its `agreed_cents`.
 */
export function buildEscrowReleaseLegs(params: {
  paymentIntentId: string | null | undefined;
  agreedAmountCents: number | null | undefined;
  topUpPaymentsRaw: Json | null | undefined;
}): EscrowReleaseLeg[] | null {
  const primaryPi = String(params.paymentIntentId ?? "").trim();
  if (!primaryPi) return null;
  const topUps = parseJobTopUpPayments(params.topUpPaymentsRaw);
  const topSum = topUps.reduce((s, t) => s + t.agreed_cents, 0);
  const totalAgreed = Math.max(0, Math.floor(Number(params.agreedAmountCents) || 0));
  const primaryAgreed = totalAgreed - topSum;
  if (primaryAgreed < 1) return null;
  const legs: EscrowReleaseLeg[] = [
    { paymentIntentId: primaryPi, agreedCents: primaryAgreed, topUpIndex: -1 },
  ];
  topUps.forEach((t, idx) => {
    if (t.payment_intent_id && t.agreed_cents >= 1) {
      legs.push({
        paymentIntentId: t.payment_intent_id,
        agreedCents: t.agreed_cents,
        topUpIndex: idx,
      });
    }
  });
  return legs;
}

/** Lister top-up rules: min AUD 20, steps of AUD 10. */
export const JOB_TOP_UP_MIN_CENTS = 2000;
export const JOB_TOP_UP_STEP_CENTS = 1000;

export function isValidJobTopUpAgreedCents(cents: number): boolean {
  if (!Number.isFinite(cents) || cents < JOB_TOP_UP_MIN_CENTS) return false;
  if ((cents - JOB_TOP_UP_MIN_CENTS) % JOB_TOP_UP_STEP_CENTS !== 0) return false;
  return true;
}

/** After lister accepts a cleaner additional-payment request (matches request form: min AUD 1). */
export const CLEANER_REQUEST_TOP_UP_MIN_CENTS = 100;

export function isValidCleanerRequestTopUpCents(cents: number): boolean {
  return (
    Number.isFinite(cents) &&
    cents >= CLEANER_REQUEST_TOP_UP_MIN_CENTS &&
    cents <= 100_000_000
  );
}

/** Stripe session fulfillment: manual lister top-up rules OR approved cleaner-request amount. */
export function isValidStoredTopUpAgreedCents(cents: number): boolean {
  if (!Number.isFinite(cents) || cents < 1) return false;
  if (isValidJobTopUpAgreedCents(cents)) return true;
  return isValidCleanerRequestTopUpCents(cents);
}
