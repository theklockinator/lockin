export type PracticeHoursPoint = {
  atMs: number
  timeMinutes: number
}

/** Cumulative practice hours (inclusive) after each point, in row order. */
export function cumulativePracticeHours(
  rows: PracticeHoursPoint[],
): number[] {
  let total = 0
  return rows.map((r) => {
    total += r.timeMinutes / 60
    return total
  })
}

export function totalPracticeHours(rows: PracticeHoursPoint[]): number {
  return rows.reduce((acc, r) => acc + r.timeMinutes, 0) / 60
}

/**
 * Practice hours at a wall-clock instant: 0 before the first paper,
 * linear between papers, flat at total after the last.
 */
export function practiceHoursAtMs(
  rows: PracticeHoursPoint[],
  atMs: number,
): number {
  if (rows.length === 0) return 0
  const sorted = [...rows].sort((a, b) => a.atMs - b.atMs)
  const cumulative = cumulativePracticeHours(sorted)

  if (atMs < sorted[0]!.atMs) return 0

  const last = sorted[sorted.length - 1]!
  if (atMs >= last.atMs) return cumulative[cumulative.length - 1]!

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (atMs >= a.atMs && atMs <= b.atMs) {
      const span = b.atMs - a.atMs
      const t = span < 1 ? 0 : (atMs - a.atMs) / span
      return cumulative[i]! + t * (cumulative[i + 1]! - cumulative[i]!)
    }
  }

  return cumulative[cumulative.length - 1]!
}
