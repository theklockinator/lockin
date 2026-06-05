import { format } from 'date-fns'
import type { ChartPoint } from './stats-scope'
import type { MarksRegression } from './stats-prediction'

export type ChartHoverSnapshot = {
  atMs: number
  dateLabel: string
  marksPercent: number
  timeMinutes: number
  timeUsedPercent: number
  rfPercent: number | null
  nearest: ChartPoint | null
  interpolated: boolean
}

export function formatChartTimeHover(
  timeMinutes: number,
  timeUsedPercent: number,
): string {
  const min = Math.round(timeMinutes)
  const pct = Math.round(timeUsedPercent * 10) / 10
  return `${min} min (${pct}%)`
}

function interpolateAlongSeries(
  sorted: ChartPoint[],
  atMs: number,
): {
  marksPercent: number
  timeMinutes: number
  timeUsedPercent: number
} {
  if (sorted.length === 0) {
    return { marksPercent: 0, timeMinutes: 0, timeUsedPercent: 0 }
  }
  if (sorted.length === 1) {
    const p = sorted[0]!
    return {
      marksPercent: p.marksPercent,
      timeMinutes: p.timeMinutes,
      timeUsedPercent: p.timeUsedPercent,
    }
  }

  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  if (atMs <= first.atMs) {
    return {
      marksPercent: first.marksPercent,
      timeMinutes: first.timeMinutes,
      timeUsedPercent: first.timeUsedPercent,
    }
  }
  if (atMs >= last.atMs) {
    return {
      marksPercent: last.marksPercent,
      timeMinutes: last.timeMinutes,
      timeUsedPercent: last.timeUsedPercent,
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (atMs >= a.atMs && atMs <= b.atMs) {
      const span = b.atMs - a.atMs
      const t = span < 1 ? 0 : (atMs - a.atMs) / span
      return {
        marksPercent: a.marksPercent + t * (b.marksPercent - a.marksPercent),
        timeMinutes: a.timeMinutes + t * (b.timeMinutes - a.timeMinutes),
        timeUsedPercent:
          a.timeUsedPercent + t * (b.timeUsedPercent - a.timeUsedPercent),
      }
    }
  }

  return {
    marksPercent: last.marksPercent,
    timeMinutes: last.timeMinutes,
    timeUsedPercent: last.timeUsedPercent,
  }
}

function nearestPaper(
  sorted: ChartPoint[],
  atMs: number,
  spanMs: number,
): ChartPoint | null {
  let best: ChartPoint | null = null
  let bestDist = Infinity
  for (const p of sorted) {
    const d = Math.abs(p.atMs - atMs)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  const threshold = Math.max(spanMs * 0.03, 2 * 3_600_000)
  return best && bestDist <= threshold ? best : null
}

export function buildChartHoverSnapshot(
  series: ChartPoint[],
  regression: MarksRegression | null,
  atMs: number,
  spanMs: number,
): ChartHoverSnapshot {
  const sorted = [...series].sort((a, b) => a.atMs - b.atMs)
  const nearest = nearestPaper(sorted, atMs, spanMs)

  let marksPercent: number
  let timeMinutes: number
  let timeUsedPercent: number
  let interpolated: boolean

  if (nearest) {
    marksPercent = nearest.marksPercent
    timeMinutes = nearest.timeMinutes
    timeUsedPercent = nearest.timeUsedPercent
    interpolated = false
  } else {
    const interp = interpolateAlongSeries(sorted, atMs)
    marksPercent = interp.marksPercent
    timeMinutes = interp.timeMinutes
    timeUsedPercent = interp.timeUsedPercent
    interpolated = true
  }

  const rfPercent = regression
    ? Math.round(
        regression.predictAtMs(atMs, regression.imputedTimeUsedPercent) * 10,
      ) / 10
    : null

  return {
    atMs,
    dateLabel: format(new Date(atMs), 'EEE d MMM yyyy, HH:mm'),
    marksPercent: Math.round(marksPercent * 10) / 10,
    timeMinutes: Math.round(timeMinutes * 10) / 10,
    timeUsedPercent: Math.round(timeUsedPercent * 10) / 10,
    rfPercent,
    nearest,
    interpolated,
  }
}

/** Max tick labels on the chart’s right-hand time-used % axis. */
export const MAX_TIME_PERCENT_AXIS_LABELS = 5

export function timePercentAxisTicks(
  max: number,
  maxLabels = MAX_TIME_PERCENT_AXIS_LABELS,
): number[] {
  if (max <= 0) return [0]
  if (maxLabels < 2) return [0, max]

  const steps = [10, 25, 50]
  let step = 50
  for (const s of steps) {
    if (Math.floor(max / s) + 1 <= maxLabels) {
      step = s
      break
    }
  }
  if (Math.floor(max / step) + 1 > maxLabels) {
    step = Math.max(5, Math.ceil(max / (maxLabels - 1) / 5) * 5)
  }

  const ticks = new Set<number>([0])
  for (let t = step; t < max; t += step) ticks.add(t)
  ticks.add(max)
  return [...ticks].sort((a, b) => a - b)
}

export const CHART_WIDTH = 640
export const CHART_HEIGHT = 240
export const CHART_PAD = { top: 16, right: 48, bottom: 40, left: 44 }
export const CHART_PLOT_W =
  CHART_WIDTH - CHART_PAD.left - CHART_PAD.right
export const CHART_PLOT_H =
  CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom

/** Map screen coords to plot X in viewBox space (handles responsive SVG letterboxing). */
export function clientToPlotX(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): number {
  const ctm = svg.getScreenCTM()
  if (ctm) {
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const local = pt.matrixTransform(ctm.inverse())
    return Math.max(0, Math.min(CHART_PLOT_W, local.x - CHART_PAD.left))
  }

  const rect = svg.getBoundingClientRect()
  const relX = (clientX - rect.left) / rect.width
  const svgX = relX * CHART_WIDTH
  return Math.max(0, Math.min(CHART_PLOT_W, svgX - CHART_PAD.left))
}

export function atMsFromPlotPointer(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  minMs: number,
  spanMs: number,
): number {
  const plotX = clientToPlotX(clientX, clientY, svg)
  const t = plotX / CHART_PLOT_W
  return minMs + t * spanMs
}
