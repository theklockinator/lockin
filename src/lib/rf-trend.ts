import type { MarksRegression } from './stats-prediction'

/** Interior samples along RF curve (endpoints of hour range excluded). */
const INTERIOR_SAMPLES = 6

const SUDDEN_SLOPE = 4
const SLOPE_IMPROVING = 1.2
const SLOPE_DECLINING = -1.2
const VOLATILE_RESIDUAL_STD = 5
const VOLATILE_SLOPE_STD = 2.8
const LUCK_NET_RISE = 10
const LUCK_FLAT_SLOPE = 1.4

export type GradeTrendId =
  | 'improving'
  | 'declining'
  | 'stable'
  | 'volatile'
  | 'sudden-rise'
  | 'sudden-decline'
  | 'occasional-luck'
  | 'insufficient'

export type TimeTrendId =
  | 'steady-pace'
  | 'getting-faster'
  | 'getting-slower'
  | 'insufficient'

export type RfTrendAnalysis = {
  grade: GradeTrendId
  time: TimeTrendId
  gradeDetail: string
  timeDetail: string
  sampleCount: number
  meanSlope: number | null
}

export const GRADE_TREND_LABELS: Record<GradeTrendId, string> = {
  improving: 'Improving',
  declining: 'Declining',
  stable: 'Stable',
  volatile: 'Volatile',
  'sudden-rise': 'Sudden Rise',
  'sudden-decline': 'Sudden Decline',
  'occasional-luck': 'Occasional Luck',
  insufficient: '—',
}

export const TIME_TREND_LABELS: Record<TimeTrendId, string> = {
  'steady-pace': 'Steady speed',
  'getting-faster': 'Getting faster',
  'getting-slower': 'Getting slower',
  insufficient: '—',
}

function std(values: number[]): number {
  if (values.length < 2) return 0
  const m = values.reduce((a, b) => a + b, 0) / values.length
  const v =
    values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(v)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

/** Spread of marks around a linear fit (ignores steady climb/drop). */
function linearResidualStd(hours: number[], marks: number[]): number {
  const n = hours.length
  const meanH = hours.reduce((a, b) => a + b, 0) / n
  const meanM = marks.reduce((a, b) => a + b, 0) / n
  let shh = 0
  let shm = 0
  for (let i = 0; i < n; i++) {
    const dh = hours[i]! - meanH
    shh += dh * dh
    shm += dh * (marks[i]! - meanM)
  }
  if (shh < 1e-12) return 0
  const slope = shm / shh
  const intercept = meanM - slope * meanH
  const residuals = marks.map(
    (m, i) => m - (intercept + slope * hours[i]!),
  )
  return std(residuals)
}

function sampleRfInterior(
  regression: MarksRegression,
): { hours: number[]; marks: number[] } {
  const hStart = Math.min(...regression.trainingPoints.map((p) => p.hours))
  const hEnd = Math.max(
    regression.nowPoint.hours,
    ...regression.trainingPoints.map((p) => p.hours),
  )
  const span = hEnd - hStart
  if (span < 1 / 60) {
    const h = hEnd
    const m = regression.predict({
      hours: h,
      timeUsedPercent: regression.imputedTimeUsedPercent,
    })
    return { hours: [h], marks: [m] }
  }

  const hours: number[] = []
  const marks: number[] = []
  const t = regression.imputedTimeUsedPercent

  for (let i = 1; i <= INTERIOR_SAMPLES; i++) {
    const hoursSince =
      hStart + (span * i) / (INTERIOR_SAMPLES + 1)
    hours.push(hoursSince)
    marks.push(
      regression.predict({
        hours: hoursSince,
        timeUsedPercent: t,
      }),
    )
  }

  return { hours, marks }
}

function classifyGrade(
  hours: number[],
  marks: number[],
  slopes: number[],
): { id: GradeTrendId; detail: string } {
  if (marks.length < 3 || slopes.length < 2) {
    return { id: 'insufficient', detail: 'Not enough RF samples' }
  }

  const meanSlope =
    slopes.reduce((a, b) => a + b, 0) / slopes.length
  const residualStd = linearResidualStd(hours, marks)
  const slopeStd = std(slopes)
  const maxSlope = Math.max(...slopes)
  const minSlope = Math.min(...slopes)
  const medAbsSlope = median(slopes.map((s) => Math.abs(s)))

  const netRise = marks[marks.length - 1]! - marks[0]!
  const maxMark = Math.max(...marks)
  const medMark = median(marks)
  const dominantJump =
    slopes.length > 0 &&
    Math.max(...slopes.map((s) => Math.abs(s))) * (hours[hours.length - 1]! - hours[0]!) >
      Math.abs(netRise) * 0.55

  if (
    maxSlope >= SUDDEN_SLOPE &&
    maxSlope >= 2.2 * Math.max(medAbsSlope, 0.5)
  ) {
    return {
      id: 'sudden-rise',
      detail: `Sharp RF rise (+${Math.round(maxSlope * 10) / 10}%/hr peak)`,
    }
  }

  if (
    minSlope <= -SUDDEN_SLOPE &&
    minSlope <= -2.2 * Math.max(medAbsSlope, 0.5)
  ) {
    return {
      id: 'sudden-decline',
      detail: `Sharp RF drop (${Math.round(minSlope * 10) / 10}%/hr trough)`,
    }
  }

  if (
    residualStd >= VOLATILE_RESIDUAL_STD ||
    slopeStd >= VOLATILE_SLOPE_STD
  ) {
    return {
      id: 'volatile',
      detail: `Uneven RF path (σ ${Math.round(residualStd * 10) / 10}% off trend)`,
    }
  }

  if (
    netRise >= LUCK_NET_RISE &&
    Math.abs(meanSlope) < LUCK_FLAT_SLOPE &&
    maxMark - medMark >= 8 &&
    dominantJump
  ) {
    return {
      id: 'occasional-luck',
      detail: 'Most gains from one RF jump, otherwise flat',
    }
  }

  if (meanSlope >= SLOPE_IMPROVING) {
    return {
      id: 'improving',
      detail: `RF slope +${Math.round(meanSlope * 10) / 10}%/hr`,
    }
  }

  if (meanSlope <= SLOPE_DECLINING) {
    return {
      id: 'declining',
      detail: `RF slope ${Math.round(meanSlope * 10) / 10}%/hr`,
    }
  }

  return {
    id: 'stable',
    detail: `RF slope ~${Math.round(meanSlope * 10) / 10}%/hr`,
  }
}

/** How exam-time share changes per practice hour between papers (negative = faster). */
function timeUsedSlopesFromPapers(
  points: { hours: number; timeUsedPercent: number }[],
): number[] {
  const sorted = [...points].sort((a, b) => a.hours - b.hours)
  const slopes: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const dh = sorted[i + 1]!.hours - sorted[i]!.hours
    if (dh < 1e-9) continue
    slopes.push(
      (sorted[i + 1]!.timeUsedPercent - sorted[i]!.timeUsedPercent) / dh,
    )
  }
  return slopes
}

function classifyTime(
  points: { hours: number; timeUsedPercent: number }[],
): {
  id: TimeTrendId
  detail: string
} {
  const slopes = timeUsedSlopesFromPapers(points)
  if (slopes.length < 1) {
    return { id: 'insufficient', detail: 'Need 2+ papers' }
  }

  const meanSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length
  const rounded = Math.round(meanSlope * 10) / 10

  if (meanSlope <= SLOPE_DECLINING) {
    const rate = Math.abs(rounded)
    return {
      id: 'getting-faster',
      detail:
        rate < 0.05
          ? 'Recent papers finish quicker than earlier ones'
          : `Finishing ~${rate}% quicker per practice hr (vs earlier papers)`,
    }
  }

  if (meanSlope >= SLOPE_IMPROVING) {
    const rate = Math.abs(rounded)
    return {
      id: 'getting-slower',
      detail:
        rate < 0.05
          ? 'Recent papers take longer than earlier ones'
          : `Finishing ~${rate}% slower per practice hr (vs earlier papers)`,
    }
  }

  const paceAbs = Math.abs(rounded)
  return {
    id: 'steady-pace',
    detail:
      paceAbs < 0.05
        ? 'Paper speed has stayed about the same'
        : `Speed roughly flat (±${paceAbs}%/practice hr)`,
  }
}

export function analyzeRfTrends(
  regression: MarksRegression | null,
): RfTrendAnalysis {
  if (!regression || regression.trainingPoints.length < 2) {
    return {
      grade: 'insufficient',
      time: 'insufficient',
      gradeDetail: 'Need 2+ papers and RF fit',
      timeDetail: 'Need 2+ papers and RF fit',
      sampleCount: 0,
      meanSlope: null,
    }
  }

  const { hours, marks } = sampleRfInterior(regression)

  if (hours.length < 3) {
    return {
      grade: 'insufficient',
      time: 'insufficient',
      gradeDetail: 'Hour span too short',
      timeDetail: 'Hour span too short',
      sampleCount: hours.length,
      meanSlope: null,
    }
  }

  const slopes: number[] = []
  for (let i = 0; i < hours.length - 1; i++) {
    const dh = hours[i + 1]! - hours[i]!
    if (dh < 1e-9) continue
    slopes.push((marks[i + 1]! - marks[i]!) / dh)
  }

  const grade = classifyGrade(hours, marks, slopes)
  const time = classifyTime(regression.trainingPoints)
  const meanSlope =
    slopes.length > 0
      ? Math.round(
          (slopes.reduce((a, b) => a + b, 0) / slopes.length) * 100,
        ) / 100
      : null

  return {
    grade: grade.id,
    time: time.id,
    gradeDetail: grade.detail,
    timeDetail: time.detail,
    sampleCount: hours.length,
    meanSlope,
  }
}
