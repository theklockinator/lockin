import { parseDecimalInput } from './decimal-input'

/** Map predicted % to heatmap hue; values clamp to [scaleMin, scaleMax]. */
export function heatColorForScale(
  percent: number,
  scaleMin: number,
  scaleMax: number,
): string {
  const span = scaleMax - scaleMin
  const t =
    span < 1e-9
      ? 0.5
      : Math.min(1, Math.max(0, (percent - scaleMin) / span))
  const hue = t * 120
  return `hsl(${hue} 45% 38% / 0.55)`
}

export function parseScaleInput(raw: string, fallback: number): number {
  const n = parseDecimalInput(raw)
  if (n === null) return fallback
  return Math.min(100, Math.max(0, n))
}

export function normalizeScaleRange(
  min: number,
  max: number,
): { min: number; max: number } {
  const a = Math.min(100, Math.max(0, min))
  const b = Math.min(100, Math.max(0, max))
  if (a < b) return { min: a, max: b }
  if (b <= 0) return { min: 0, max: 1 }
  return { min: Math.max(0, b - 1), max: b }
}

/** Marks % from a Y coordinate on the legend gradient (bottom = 0, top = 100). */
export function percentFromGradientClientY(
  clientY: number,
  rect: DOMRect,
): number {
  const t = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height))
  return Math.round(t * 1000) / 10
}

export function scaleRangeFromGradientDrag(
  which: 'min' | 'max',
  clientY: number,
  rect: DOMRect,
  currentMin: number,
  currentMax: number,
): { min: number; max: number } {
  const percent = percentFromGradientClientY(clientY, rect)
  if (which === 'min') return normalizeScaleRange(percent, currentMax)
  return normalizeScaleRange(currentMin, percent)
}

/** Display scale bounds with a dot decimal separator (e.g. 68.5). */
export function formatScalePercentInput(n: number): string {
  const rounded = Math.round(n * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1)
}
