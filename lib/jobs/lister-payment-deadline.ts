/** Days after a job is won (accepted, before escrow) for the lister to complete Pay & Start Job. */
export const LISTER_PAY_AND_START_DEADLINE_DAYS = 7;

export function listerPaymentDueAtFromNowIso(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  d.setUTCDate(d.getUTCDate() + LISTER_PAY_AND_START_DEADLINE_DAYS);
  return d.toISOString();
}
