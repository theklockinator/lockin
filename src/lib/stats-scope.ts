import {
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'
import { percentToGrade, type GradeBoundary } from './grade-boundaries'
import { buildMarksRegression } from './stats-prediction'
import { paperAtMs, parsePaperAt } from './paper-datetime'
import { timeUsedPercent } from './random-forest'
import { allQuotasMet, quotaMet, scorePercent } from './stats'
import type { PracticePaper, Unit } from './types'

export const STATS_SCOPES = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: '30 days' },
  { id: '3mo', label: '3 months' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All time' },
] as const

export type StatsScope = (typeof STATS_SCOPES)[number]['id']

export type ScopedPaper = {
  paper: PracticePaper
  unit: Unit
  marksPercent: number
  timeUsedPercent: number
  atMs: number
}

export type ChartPoint = {
  key: string
  atMs: number
  completedAt: string
  label: string
  marksPercent: number
  timeMinutes: number
  /** Paper minutes / unit exam duration × 100 */
  timeUsedPercent: number
  paperCount: number
  unitName?: string
  paperName?: string
}

export type ScopeSummary = {
  paperCount: number
  avgMarksPercent: number | null
  avgTimeMinutes: number | null
  bestMarksPercent: number | null
  worstMarksPercent: number | null
  quotaDaysMet: number
  quotaDaysInScope: number
  totalPracticeMinutes: number
  avgVsExamDuration: number | null
  targetExamDuration: number | null
}

export type UnitBreakdownRow = {
  unitId: string
  unitName: string
  paperCount: number
  avgMarksPercent: number | null
  avgTimeUsedPercent: number | null
  rfPercent: number | null
  avgTimeMinutes: number | null
  targetTimeMinutes: number
  timeDisplay: string
  estimatedGrade: string
  targetGrade: string
  gradeDisplay: string
}

export function scopeStartMs(scope: StatsScope, now = new Date()): number | null {
  const end = startOfDay(now).getTime()
  switch (scope) {
    case 'day':
      return end
    case 'week':
      return startOfDay(subDays(now, 6)).getTime()
    case 'month':
      return startOfDay(subDays(now, 29)).getTime()
    case '3mo':
      return startOfDay(subDays(now, 89)).getTime()
    case 'year':
      return startOfDay(subDays(now, 364)).getTime()
    case 'all':
      return null
  }
}

export function scopeEndMs(now = new Date()): number {
  return now.getTime()
}

export function isPaperInScope(
  paper: PracticePaper,
  scope: StatsScope,
  now = new Date(),
): boolean {
  const at = paperAtMs(paper)
  const end = scopeEndMs(now)
  if (at > end) return false
  const start = scopeStartMs(scope, now)
  if (start === null) return true
  return at >= start
}

export function filterUnits(
  units: Unit[],
  unitId: string | 'all',
): Unit[] {
  if (unitId === 'all') return units
  const unit = units.find((u) => u.id === unitId)
  return unit ? [unit] : []
}

export function scopedPapers(
  units: Unit[],
  scope: StatsScope,
  unitId: string | 'all' = 'all',
  now = new Date(),
): ScopedPaper[] {
  const selected = filterUnits(units, unitId)
  const rows: ScopedPaper[] = []

  for (const unit of selected) {
    for (const paper of unit.practicePapers) {
      if (!isPaperInScope(paper, scope, now)) continue
      rows.push({
        paper,
        unit,
        marksPercent: scorePercent(paper.marks, unit.maxMarks),
        timeUsedPercent: timeUsedPercent(
          paper.timeMinutes,
          unit.examDurationMinutes,
        ),
        atMs: paperAtMs(paper),
      })
    }
  }

  return rows.sort((a, b) => a.atMs - b.atMs)
}

export function scopeDateRange(
  scope: StatsScope,
  now = new Date(),
): string[] {
  const end = parseISO(format(now, 'yyyy-MM-dd'))
  const startMs = scopeStartMs(scope, now)
  const start = startMs ? new Date(startMs) : end
  return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'))
}

export function computeScopeSummary(
  units: Unit[],
  scope: StatsScope,
  unitId: string | 'all' = 'all',
  now = new Date(),
): ScopeSummary {
  const selected = filterUnits(units, unitId)
  const rows = scopedPapers(units, scope, unitId, now)

  let quotaDaysMet = 0
  const days = scope === 'all' ? [] : scopeDateRange(scope, now)
  for (const date of days) {
    if (unitId === 'all') {
      if (selected.length > 0 && allQuotasMet(selected, date)) quotaDaysMet++
    } else {
      const unit = selected[0]
      if (unit && quotaMet(unit, date)) quotaDaysMet++
    }
  }

  if (rows.length === 0) {
    const durations = selected.map((u) => u.examDurationMinutes)
    const targetExamDuration =
      durations.length === 0
        ? null
        : Math.round(
            durations.reduce((a, b) => a + b, 0) / durations.length,
          )
    return {
      paperCount: 0,
      avgMarksPercent: null,
      avgTimeMinutes: null,
      bestMarksPercent: null,
      worstMarksPercent: null,
      quotaDaysMet,
      quotaDaysInScope: days.length,
      totalPracticeMinutes: 0,
      avgVsExamDuration: null,
      targetExamDuration,
    }
  }

  const percents = rows.map((r) => r.marksPercent)
  const times = rows.map((r) => r.paper.timeMinutes)
  const avgMarksPercent =
    Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) /
    10
  const avgTimeMinutes =
    Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
  const totalPracticeMinutes = times.reduce((a, b) => a + b, 0)

  const durations = selected.map((u) => u.examDurationMinutes)
  const targetExamDuration =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)

  return {
    paperCount: rows.length,
    avgMarksPercent,
    avgTimeMinutes,
    bestMarksPercent: Math.max(...percents),
    worstMarksPercent: Math.min(...percents),
    quotaDaysMet,
    quotaDaysInScope: days.length,
    totalPracticeMinutes,
    avgVsExamDuration:
      targetExamDuration === null
        ? null
        : Math.round((avgTimeMinutes - targetExamDuration) * 10) / 10,
    targetExamDuration,
  }
}

export function buildChartSeries(rows: ScopedPaper[]): ChartPoint[] {
  return rows.map((r) => ({
    key: r.paper.id,
    atMs: r.atMs,
    completedAt: r.paper.completedAt,
    label: format(parsePaperAt(r.paper.completedAt), 'd MMM HH:mm'),
    marksPercent: r.marksPercent,
    timeMinutes: r.paper.timeMinutes,
    timeUsedPercent: r.timeUsedPercent,
    paperCount: 1,
    unitName: r.unit.name,
    paperName: r.paper.name || undefined,
  }))
}

export function matchExamForUnit(
  unit: Unit,
  exams: { subject: string; name: string; targetGrade: string }[],
): { targetGrade: string; examName: string } | null {
  const key = unit.name.trim().toLowerCase()
  if (!key) return null

  for (const exam of exams) {
    const subject = exam.subject.trim().toLowerCase()
    const name = exam.name.trim().toLowerCase()
    if (
      (subject && (subject.includes(key) || key.includes(subject))) ||
      (name && (name.includes(key) || key.includes(name)))
    ) {
      if (exam.targetGrade.trim()) {
        return {
          targetGrade: exam.targetGrade.trim(),
          examName: exam.name,
        }
      }
    }
  }
  return null
}

export function unitBreakdown(
  units: Unit[],
  scope: StatsScope,
  boundaries: GradeBoundary[],
  exams: { subject: string; name: string; targetGrade: string }[],
  now = new Date(),
): UnitBreakdownRow[] {
  return filterUnits(units, 'all')
    .map((unit) => {
      const rows = scopedPapers([unit], scope, unit.id, now)
      const summary = computeScopeSummary([unit], scope, unit.id, now)
      const rfRows = rows.map((r) => ({
        atMs: r.atMs,
        timeMinutes: r.paper.timeMinutes,
        marksPercent: r.marksPercent,
        timeUsedPercent: r.timeUsedPercent,
      }))
      const reg = buildMarksRegression(rfRows, now)
      const predicted =
        reg?.predictPercentNow ??
        (summary.avgMarksPercent !== null ? summary.avgMarksPercent : null)
      const estimatedGrade =
        predicted === null ? '—' : percentToGrade(predicted, boundaries).grade
      const exam = matchExamForUnit(unit, exams)
      const targetGrade = exam?.targetGrade ?? '—'
      const avg =
        summary.avgTimeMinutes !== null
          ? `${summary.avgTimeMinutes} min`
          : '—'
      const avgTimeUsedPercent =
        rows.length === 0
          ? null
          : Math.round(
              (rows.reduce((acc, r) => acc + r.timeUsedPercent, 0) /
                rows.length) *
                10,
            ) / 10
      const rfPercent =
        predicted === null ? null : Math.round(predicted * 10) / 10

      return {
        unitId: unit.id,
        unitName: unit.name,
        paperCount: summary.paperCount,
        avgMarksPercent: summary.avgMarksPercent,
        avgTimeUsedPercent,
        rfPercent,
        avgTimeMinutes: summary.avgTimeMinutes,
        targetTimeMinutes: unit.examDurationMinutes,
        timeDisplay: `${avg} / ${unit.examDurationMinutes} min`,
        estimatedGrade,
        targetGrade,
        gradeDisplay: `${estimatedGrade} / ${targetGrade}`,
      }
    })
    .filter((row) => row.paperCount > 0)
    .sort((a, b) => b.paperCount - a.paperCount)
}
