export type GradeBoundary = {
  grade: string
  minPercent: number
}

export const DEFAULT_GRADE_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A*', minPercent: 90 },
  { grade: 'A', minPercent: 80 },
  { grade: 'B', minPercent: 70 },
  { grade: 'C', minPercent: 60 },
  { grade: 'D', minPercent: 50 },
  { grade: 'E', minPercent: 40 },
  { grade: 'U', minPercent: 0 },
]

export function sortBoundaries(boundaries: GradeBoundary[]): GradeBoundary[] {
  return [...boundaries].sort((a, b) => b.minPercent - a.minPercent)
}

export function normalizeBoundaries(
  boundaries: GradeBoundary[],
): GradeBoundary[] {
  const sorted = sortBoundaries(
    boundaries
      .map((b) => ({
        grade: b.grade.trim() || '?',
        minPercent: Math.min(100, Math.max(0, Math.round(b.minPercent))),
      }))
      .filter((b) => b.grade !== '?'),
  )
  return sorted.length > 0 ? sorted : DEFAULT_GRADE_BOUNDARIES
}

export function percentToGrade(
  percent: number,
  boundaries: GradeBoundary[] = DEFAULT_GRADE_BOUNDARIES,
): { grade: string; minPercent: number } {
  const sorted = sortBoundaries(boundaries)
  const p = Math.min(100, Math.max(0, percent))
  for (const b of sorted) {
    if (p >= b.minPercent) return { grade: b.grade, minPercent: b.minPercent }
  }
  return sorted[sorted.length - 1] ?? { grade: 'U', minPercent: 0 }
}

export function resolveGradeMinPercent(
  gradeName: string,
  boundaries: GradeBoundary[],
): number | null {
  const key = gradeName.trim().toUpperCase()
  if (!key) return null
  const sorted = sortBoundaries(boundaries)
  const exact = sorted.find((b) => b.grade.toUpperCase() === key)
  if (exact) return exact.minPercent
  const partial = sorted.find((b) => key.includes(b.grade.toUpperCase()))
  return partial?.minPercent ?? null
}
