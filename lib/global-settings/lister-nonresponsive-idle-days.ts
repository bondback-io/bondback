/** Clamp 0–7; default 0 = no inactivity wait when unset. (Not a Server Action — safe to import from client bundles.) */
export function normalizeListerNonresponsiveCancelIdleDays(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n)) {
    return Math.max(0, Math.min(7, Math.floor(n)));
  }
  return 0;
}
