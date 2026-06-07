import {
  boundariesToPiecewiseFormula,
  evaluateGradeFormula,
} from './grade-formula'

export type GradeBoundary = {
  grade: string
  minPercent: number
}

export type GradeBoundaryMode = 'table' | 'formula'

export type GradeBoundarySettings = {
  mode: GradeBoundaryMode
  boundaries: GradeBoundary[]
  formula: string
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

export const DEFAULT_GRADE_FORMULA = boundariesToPiecewiseFormula(
  DEFAULT_GRADE_BOUNDARIES,
)

export const DEFAULT_GRADE_SETTINGS: GradeBoundarySettings = {
  mode: 'table',
  boundaries: DEFAULT_GRADE_BOUNDARIES,
  formula: DEFAULT_GRADE_FORMULA,
}

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

export function normalizeGradeSettings(
  settings: Partial<GradeBoundarySettings>,
): GradeBoundarySettings {
  const boundaries = normalizeBoundaries(
    settings.boundaries ?? DEFAULT_GRADE_BOUNDARIES,
  )
  const formula =
    settings.formula?.trim() ||
    boundariesToPiecewiseFormula(boundaries)
  const mode = settings.mode === 'formula' ? 'formula' : 'table'
  return { mode, boundaries, formula }
}

function normalizeGradeKey(name: string): string {
  return name.trim().toUpperCase()
}

/** Match exam target names to formula/table grade labels. */
export function gradesMatch(target: string, candidate: string): boolean {
  const a = normalizeGradeKey(target)
  const b = normalizeGradeKey(candidate)
  if (!a || !b) return false
  if (a === b) return true
  if (b.includes(a) || a.includes(b)) return true
  return false
}

function percentToGradeTable(
  percent: number,
  boundaries: GradeBoundary[],
): { grade: string; minPercent: number } {
  const sorted = sortBoundaries(boundaries)
  const p = Math.min(100, Math.max(0, percent))
  for (const b of sorted) {
    if (p >= b.minPercent) return { grade: b.grade, minPercent: b.minPercent }
  }
  return sorted[sorted.length - 1] ?? { grade: 'U', minPercent: 0 }
}

function minPercentForGradeFormula(
  gradeName: string,
  formula: string,
): number | null {
  let found: number | null = null
  for (let p = 0; p <= 1000; p++) {
    const percent = p / 10
    const ev = evaluateGradeFormula(formula, percent)
    if (!ev.ok) return null
    if (gradesMatch(gradeName, ev.grade)) {
      found = percent
      break
    }
  }
  return found
}

function minPercentForGradeAtPercent(
  gradeName: string,
  formula: string,
  atPercent: number,
): number {
  const at = evaluateGradeFormula(formula, atPercent)
  if (!at.ok || !gradesMatch(gradeName, at.grade)) {
    return minPercentForGradeFormula(gradeName, formula) ?? 0
  }
  let low = 0
  let high = atPercent
  for (let i = 0; i < 20; i++) {
    const mid = Math.round(((low + high) / 2) * 10) / 10
    const ev = evaluateGradeFormula(formula, mid)
    if (!ev.ok) break
    if (gradesMatch(gradeName, ev.grade)) {
      high = mid
    } else {
      low = mid
    }
  }
  return Math.round(high * 10) / 10
}

export function percentToGrade(
  percent: number,
  settingsOrBoundaries:
    | GradeBoundarySettings
    | GradeBoundary[] = DEFAULT_GRADE_BOUNDARIES,
): { grade: string; minPercent: number } {
  if (Array.isArray(settingsOrBoundaries)) {
    return percentToGradeTable(percent, settingsOrBoundaries)
  }
  const settings = normalizeGradeSettings(settingsOrBoundaries)
  if (settings.mode === 'table') {
    return percentToGradeTable(percent, settings.boundaries)
  }
  const ev = evaluateGradeFormula(settings.formula, percent)
  if (!ev.ok) {
    return percentToGradeTable(percent, settings.boundaries)
  }
  const minPercent = minPercentForGradeAtPercent(
    ev.grade,
    settings.formula,
    percent,
  )
  return { grade: ev.grade, minPercent }
}

export function resolveGradeMinPercent(
  gradeName: string,
  settingsOrBoundaries: GradeBoundarySettings | GradeBoundary[],
): number | null {
  if (Array.isArray(settingsOrBoundaries)) {
    const key = normalizeGradeKey(gradeName)
    if (!key) return null
    const sorted = sortBoundaries(settingsOrBoundaries)
    const exact = sorted.find((b) => normalizeGradeKey(b.grade) === key)
    if (exact) return exact.minPercent
    const partial = sorted.find((b) =>
      key.includes(normalizeGradeKey(b.grade)),
    )
    return partial?.minPercent ?? null
  }

  const settings = normalizeGradeSettings(settingsOrBoundaries)
  if (settings.mode === 'table') {
    return resolveGradeMinPercent(gradeName, settings.boundaries)
  }
  return minPercentForGradeFormula(gradeName, settings.formula)
}

export { boundariesToPiecewiseFormula, evaluateGradeFormula }
