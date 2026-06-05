import {
  percentToGrade,
  type GradeBoundary,
} from './grade-boundaries'
import {
  practiceHoursAtMs,
  totalPracticeHours,
} from './practice-hours'
import {
  fitMarksRandomForest,
  hoursToReachPercent,
  regressionCurve,
  timeUsedPercent,
  type MarksRfRow,
} from './random-forest'
export type RegressionRow = MarksRfRow

type RfRowInput =
  | MarksRfRow
  | {
      atMs: number
      marksPercent: number
      timeUsedPercent: number
      paper: { timeMinutes: number }
    }

export function toMarksRfRows(rows: RfRowInput[]): MarksRfRow[] {
  return rows.map((r) =>
    'paper' in r
      ? {
          atMs: r.atMs,
          timeMinutes: r.paper.timeMinutes,
          marksPercent: r.marksPercent,
          timeUsedPercent: r.timeUsedPercent,
        }
      : r,
  )
}

export type MarksRegression = {
  predict: (input: {
    hours: number
    timeUsedPercent: number
  }) => number
  predictAtMs: (atMs: number, timeUsedPercent: number) => number
  /** Mean time-used % from papers — used at "now" and on the time-axis curve */
  imputedTimeUsedPercent: number
  predictPercentNow: number
  originMs: number
  curve: { atMs: number; predictedPercent: number }[]
  trainingPoints: {
    hours: number
    timeUsedPercent: number
    marksPercent: number
  }[]
  nowPoint: {
    hours: number
    timeUsedPercent: number
    predictedPercent: number
  }
}

export function rowsToRfInput(rows: RegressionRow[]): RegressionRow[] {
  return rows
}

export function buildMarksRegression(
  rows: RfRowInput[],
  now = new Date(),
): MarksRegression | null {
  const rfRows = toMarksRfRows(rows)
  const fit = fitMarksRandomForest(rfRows)
  if (!fit) return null

  const nowMs = now.getTime()
  const minMs = Math.min(...rfRows.map((p) => p.atMs))
  const maxMs = Math.max(nowMs, ...rfRows.map((p) => p.atMs))
  const imputed = fit.imputedTimeUsedPercent
  const practiceHoursNow = totalPracticeHours(rfRows)

  const predictAtMsImputed = (atMs: number) =>
    fit.predictAtMs(atMs, imputed)

  const predictAtPracticeHours = (hours: number) =>
    fit.predict({ hours, timeUsedPercent: imputed })

  return {
    predict: fit.predict,
    predictAtMs: fit.predictAtMs,
    imputedTimeUsedPercent: imputed,
    predictPercentNow: predictAtPracticeHours(practiceHoursNow),
    originMs: fit.originMs,
    curve: regressionCurve(predictAtMsImputed, minMs, maxMs),
    trainingPoints: rfRows.map((r) => ({
      hours: practiceHoursAtMs(rfRows, r.atMs),
      timeUsedPercent: r.timeUsedPercent,
      marksPercent: r.marksPercent,
    })),
    nowPoint: {
      hours: practiceHoursNow,
      timeUsedPercent: imputed,
      predictedPercent: predictAtPracticeHours(practiceHoursNow),
    },
  }
}

export { timeUsedPercent }

export function expectedGradeFromRegression(
  regression: MarksRegression | null,
  boundaries: GradeBoundary[],
): { grade: string; percent: number } | null {
  if (!regression) return null
  const percent = Math.round(regression.predictPercentNow * 10) / 10
  return { grade: percentToGrade(percent, boundaries).grade, percent }
}

export function practicePercentPerHour(
  regression: MarksRegression | null,
  rows: RfRowInput[],
): number | null {
  const rfRows = toMarksRfRows(rows)
  if (!regression || rfRows.length < 2) return null
  const first = rfRows[0]!
  const last = rfRows[rfRows.length - 1]!
  const hours =
    practiceHoursAtMs(rfRows, last.atMs) - practiceHoursAtMs(rfRows, first.atMs)
  if (hours < 1 / 60) return null
  const t = regression.imputedTimeUsedPercent
  const y0 = regression.predictAtMs(first.atMs, t)
  const y1 = regression.predictAtMs(last.atMs, t)
  return Math.round(((y1 - y0) / hours) * 100) / 100
}

export function hoursToTargetFromRows(
  rows: RfRowInput[],
  targetMinPercent: number,
): number | null {
  const rfRows = toMarksRfRows(rows)
  const fit = fitMarksRandomForest(rfRows)
  if (!fit) return null

  const fromHours = totalPracticeHours(rfRows)
  return hoursToReachPercent(
    fit.predict,
    targetMinPercent,
    {
      hours: fromHours,
      timeUsedPercent: fit.imputedTimeUsedPercent,
    },
  )
}

export function formatHoursUntil(hours: number | null): string {
  if (hours === null) return '—'
  if (hours <= 0) return 'On target'
  if (hours < 48) return `~${Math.round(hours)} practice hr`
  const days = Math.round(hours / 24)
  return `~${days}d practice`
}

export function formatPracticeRate(rate: number | null): string {
  if (rate === null) return '—'
  const sign = rate > 0 ? '+' : ''
  return `${sign}${rate}%/hr`
}

export function fallbackPredictPercent(rows: RfRowInput[]): number | null {
  if (rows.length === 0) return null
  const last = rows[rows.length - 1]!
  return last.marksPercent
}
