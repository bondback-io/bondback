export type StarDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export function computeReviewStats(rows: { overall_rating: number | null }[]) {
  const dist: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const raw = r.overall_rating;
    if (raw == null || Number.isNaN(Number(raw))) continue;
    const k = Math.min(5, Math.max(1, Math.round(Number(raw))));
    dist[k as 1 | 2 | 3 | 4 | 5] += 1;
    sum += k;
    n += 1;
  }
  return {
    total: n,
    average: n > 0 ? sum / n : null as number | null,
    distribution: dist,
  };
}
