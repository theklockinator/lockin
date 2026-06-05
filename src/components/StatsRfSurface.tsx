import { useCallback, useMemo, useRef, useState } from 'react'
import { predictionGrid } from '@/lib/random-forest'
import {
  formatScalePercentInput,
  heatColorForScale,
  normalizeScaleRange,
  parseScaleInput,
  scaleRangeFromGradientDrag,
} from '@/lib/rf-surface-scale'
import type { MarksRegression } from '@/lib/stats-prediction'
import { numberInputNoSpin } from '@/lib/form-classes'
import {
  loadHeatmapScale,
  saveHeatmapScale,
} from '@/lib/stats-heatmap-scale-storage'
import { cn } from '@/lib/utils'

type StatsRfSurfaceProps = {
  regression: MarksRegression
  className?: string
}

const W = 520
const H = 280
const PAD = { top: 20, right: 16, bottom: 44, left: 48 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const GRADIENT_HANDLE =
  'absolute -left-0.5 -right-0.5 z-10 h-1.5 cursor-ns-resize touch-none rounded-sm border bg-background shadow-sm'
const HEAT_RED = 'hsl(0 45% 38%)'
const HEAT_MID = 'hsl(60 45% 38%)'
const HEAT_GREEN = 'hsl(120 45% 38%)'

type RfSurfaceHover = {
  hours: number
  timeUsedPercent: number
  predictedPercent: number
}

function scale(
  value: number,
  min: number,
  max: number,
  range: number,
): number {
  if (max <= min) return range / 2
  return ((value - min) / (max - min)) * range
}

function plotCoordsFromPointer(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
): { plotX: number; plotY: number } {
  const relX = (clientX - svgRect.left) / svgRect.width
  const relY = (clientY - svgRect.top) / svgRect.height
  const svgX = relX * W
  const svgY = relY * H
  return {
    plotX: Math.max(0, Math.min(PLOT_W, svgX - PAD.left)),
    plotY: Math.max(0, Math.min(PLOT_H, svgY - PAD.top)),
  }
}

function hoverFromPlot(
  plotX: number,
  plotY: number,
  regression: MarksRegression,
  hoursMin: number,
  hoursMax: number,
  timeMin: number,
  timeMax: number,
): RfSurfaceHover {
  const hours =
    hoursMin + (plotX / PLOT_W) * (hoursMax - hoursMin)
  const timeUsedPercent =
    timeMax - (plotY / PLOT_H) * (timeMax - timeMin)
  const predictedPercent = regression.predict({ hours, timeUsedPercent })
  return {
    hours: Math.round(hours * 10) / 10,
    timeUsedPercent: Math.round(timeUsedPercent * 10) / 10,
    predictedPercent: Math.round(predictedPercent * 10) / 10,
  }
}

export function StatsRfSurface({
  regression,
  className,
}: StatsRfSurfaceProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const gradientRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<'min' | 'max' | null>(null)
  const [hover, setHover] = useState<RfSurfaceHover | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ leftPct: 50, topPct: 8 })
  const [marksScaleMin, setMarksScaleMin] = useState(() => {
    const saved = loadHeatmapScale()
    return saved?.min ?? 0
  })
  const [marksScaleMax, setMarksScaleMax] = useState(() => {
    const saved = loadHeatmapScale()
    return saved?.max ?? 100
  })
  const [minInput, setMinInput] = useState(() =>
    formatScalePercentInput(loadHeatmapScale()?.min ?? 0),
  )
  const [maxInput, setMaxInput] = useState(() =>
    formatScalePercentInput(loadHeatmapScale()?.max ?? 100),
  )

  const commitScaleRange = useCallback((min: number, max: number) => {
    const { min: a, max: b } = normalizeScaleRange(min, max)
    setMarksScaleMin(a)
    setMarksScaleMax(b)
    setMinInput(formatScalePercentInput(a))
    setMaxInput(formatScalePercentInput(b))
    saveHeatmapScale({ min: a, max: b })
  }, [])

  const applyMinInput = useCallback(() => {
    const nextMin = parseScaleInput(minInput, marksScaleMin)
    commitScaleRange(nextMin, marksScaleMax)
  }, [minInput, marksScaleMin, marksScaleMax, commitScaleRange])

  const applyMaxInput = useCallback(() => {
    const nextMax = parseScaleInput(maxInput, marksScaleMax)
    commitScaleRange(marksScaleMin, nextMax)
  }, [maxInput, marksScaleMin, marksScaleMax, commitScaleRange])

  const updateScaleFromGradient = useCallback(
    (which: 'min' | 'max', clientY: number) => {
      const el = gradientRef.current
      if (!el) return
      const next = scaleRangeFromGradientDrag(
        which,
        clientY,
        el.getBoundingClientRect(),
        marksScaleMin,
        marksScaleMax,
      )
      commitScaleRange(next.min, next.max)
    },
    [marksScaleMin, marksScaleMax, commitScaleRange],
  )

  const onGradientHandlePointerDown = useCallback(
    (which: 'min' | 'max') => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragHandleRef.current = which
      e.currentTarget.setPointerCapture(e.pointerId)
      updateScaleFromGradient(which, e.clientY)
    },
    [updateScaleFromGradient],
  )

  const onGradientHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const which = dragHandleRef.current
      if (!which) return
      updateScaleFromGradient(which, e.clientY)
    },
    [updateScaleFromGradient],
  )

  const onGradientHandlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragHandleRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    },
    [],
  )

  const scaleMid =
    Math.round(((marksScaleMin + marksScaleMax) / 2) * 10) / 10

  const layout = useMemo(() => {
    const points = regression.trainingPoints
    const now = regression.nowPoint

    const hoursValues = [...points.map((p) => p.hours), now.hours]
    const timeValues = [
      ...points.map((p) => p.timeUsedPercent),
      now.timeUsedPercent,
    ]

    const hoursMin = 0
    const hoursMax = Math.max(...hoursValues, 1) * 1.08
    const timeMin = 0
    const timeMax = Math.max(100, ...timeValues) * 1.05

    const grid = predictionGrid(
      regression.predict,
      hoursMin,
      hoursMax,
      timeMin,
      timeMax,
      28,
      16,
    )

    const cols = 28
    const rows = 16

    return {
      hoursMin,
      hoursMax,
      timeMin,
      timeMax,
      grid,
      cols,
      rows,
      points,
      now,
    }
  }, [regression])

  const xAt = (hours: number) =>
    PAD.left + scale(hours, layout.hoursMin, layout.hoursMax, PLOT_W)
  const yAt = (timeUsed: number) =>
    PAD.top +
    PLOT_H -
    scale(timeUsed, layout.timeMin, layout.timeMax, PLOT_H)

  const cellW = PLOT_W / layout.cols
  const cellH = PLOT_H / layout.rows

  const clearHover = useCallback(() => setHover(null), [])

  const onPlotPointer = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      if (!chartRef.current) return
      const { plotX, plotY } = plotCoordsFromPointer(
        clientX,
        clientY,
        svg.getBoundingClientRect(),
      )
      setHover(
        hoverFromPlot(
          plotX,
          plotY,
          regression,
          layout.hoursMin,
          layout.hoursMax,
          layout.timeMin,
          layout.timeMax,
        ),
      )
      const wrap = chartRef.current.getBoundingClientRect()
      const leftPct = Math.min(
        88,
        Math.max(12, ((clientX - wrap.left) / wrap.width) * 100),
      )
      const topPct = Math.min(
        72,
        Math.max(4, ((clientY - wrap.top) / wrap.height) * 100 - 4),
      )
      setTooltipPos({ leftPct, topPct })
    },
    [regression, layout],
  )

  const crossX = hover ? xAt(hover.hours) : null
  const crossY = hover ? yAt(hover.timeUsedPercent) : null

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface/30 p-3',
        className,
      )}
    >
      <p className="mb-1 text-xs font-medium text-foreground">
        2-parameter model
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Random forest on cumulative practice hours (x) and time used % (y).
        Color = predicted marks %. Diamond = your total practice hours in this
        scope at avg {regression.imputedTimeUsedPercent}% time used (not extra
        study you have not logged yet).
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div
          ref={chartRef}
          className="relative min-w-[280px] flex-1 max-w-full"
        >
          {hover && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute z-10 max-w-[min(220px,90vw)] -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-foreground shadow-md"
              style={{
                left: `${tooltipPos.leftPct}%`,
                top: `${tooltipPos.topPct}%`,
              }}
            >
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {hover.predictedPercent}%
              </p>
              <p className="text-muted-foreground">Predicted marks</p>
              <dl className="mt-2 space-y-1 tabular-nums">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Practice hours</dt>
                  <dd>{hover.hours} h</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Time used</dt>
                  <dd>{hover.timeUsedPercent}%</dd>
                </div>
              </dl>
            </div>
          )}

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className={cn(
              'h-auto w-full',
              hover !== null && 'cursor-crosshair',
            )}
            role="img"
            aria-label="Random forest prediction surface over hours and time used percent"
          >
            {layout.grid.map((cell, i) => {
              const col = i % layout.cols
              const row = Math.floor(i / layout.cols)
              const x = PAD.left + col * cellW
              const y =
                PAD.top + (layout.rows - 1 - row) * cellH
              return (
                <rect
                  key={`${col}-${row}`}
                  x={x}
                  y={y}
                  width={cellW + 0.5}
                  height={cellH + 0.5}
                  fill={heatColorForScale(
                    cell.predictedPercent,
                    marksScaleMin,
                    marksScaleMax,
                  )}
                />
              )
            })}

            {hover && crossX !== null && crossY !== null && (
              <g aria-hidden>
                <line
                  x1={crossX}
                  x2={crossX}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_H}
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.5}
                  strokeDasharray="4 3"
                />
                <line
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={crossY}
                  y2={crossY}
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.5}
                  strokeDasharray="4 3"
                />
                <circle
                  cx={crossX}
                  cy={crossY}
                  r={5}
                  fill="var(--color-background)"
                  stroke="var(--color-foreground)"
                  strokeWidth={2}
                />
              </g>
            )}

            {layout.points.map((p, i) => {
              const cx = xAt(p.hours)
              const cy = yAt(p.timeUsedPercent)
              const dim =
                hover !== null &&
                (Math.abs(p.hours - hover.hours) > 0.5 ||
                  Math.abs(p.timeUsedPercent - hover.timeUsedPercent) > 2)
              return (
                <g key={`pt-${i}`} opacity={dim ? 0.45 : 1}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill="var(--color-background)"
                    stroke="var(--color-foreground)"
                    strokeWidth={2}
                  />
                  <title>
                    Paper: {p.marksPercent}% marks · {p.timeUsedPercent}% time
                    used · {Math.round(p.hours * 10) / 10}h
                  </title>
                </g>
              )
            })}

            <g opacity={hover ? 0.55 : 1}>
              <polygon
                points={`${xAt(layout.now.hours)},${yAt(layout.now.timeUsedPercent) - 6} ${xAt(layout.now.hours) + 6},${yAt(layout.now.timeUsedPercent)} ${xAt(layout.now.hours)},${yAt(layout.now.timeUsedPercent) + 6} ${xAt(layout.now.hours) - 6},${yAt(layout.now.timeUsedPercent)}`}
                fill="var(--color-urgency-today)"
                stroke="var(--color-background)"
                strokeWidth={1.5}
              />
              <title>
                Now: RF {layout.now.predictedPercent}% ·{' '}
                {Math.round(layout.now.hours * 10) / 10}h ·{' '}
                {layout.now.timeUsedPercent}% time used (avg)
              </title>
            </g>

            <text
              x={W / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              Cumulative practice hours
            </text>
            <text
              x={14}
              y={PAD.top + PLOT_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
              className="fill-muted-foreground text-[10px]"
            >
              Time used %
            </text>

            {[0, 0.5, 1].map((t) => {
              const h = layout.hoursMin + (layout.hoursMax - layout.hoursMin) * t
              return (
                <text
                  key={`hx-${t}`}
                  x={xAt(h)}
                  y={PAD.top + PLOT_H + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px] tabular-nums"
                >
                  {Math.round(h * 10) / 10}h
                </text>
              )
            })}
            {[0, 0.5, 1].map((t) => {
              const v = layout.timeMin + (layout.timeMax - layout.timeMin) * t
              return (
                <text
                  key={`ty-${t}`}
                  x={PAD.left - 6}
                  y={yAt(v) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px] tabular-nums"
                >
                  {Math.round(v)}%
                </text>
              )
            })}

            <rect
              x={PAD.left}
              y={PAD.top}
              width={PLOT_W}
              height={PLOT_H}
              fill="transparent"
              className="cursor-crosshair"
              onPointerMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement
                if (svg) onPlotPointer(e.clientX, e.clientY, svg)
              }}
              onPointerLeave={clearHover}
              onPointerDown={(e) => {
                const svg = e.currentTarget.ownerSVGElement
                if (svg) onPlotPointer(e.clientX, e.clientY, svg)
              }}
            />
          </svg>
        </div>

        <div className="flex shrink-0 flex-col gap-2 text-xs">
          <span className="text-muted-foreground">Predicted marks %</span>
          <div
            className="flex items-stretch gap-2"
            role="group"
            aria-label="Heatmap color scale"
          >
            <div
              ref={gradientRef}
              className="relative h-28 w-4 shrink-0 rounded-sm border border-border"
            >
              {marksScaleMax < 100 && (
                <div
                  className="absolute inset-x-0 top-0 rounded-t-sm"
                  style={{
                    height: `${100 - marksScaleMax}%`,
                    background: HEAT_GREEN,
                  }}
                  aria-hidden
                />
              )}
              {marksScaleMin > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-b-sm"
                  style={{
                    height: `${marksScaleMin}%`,
                    background: HEAT_RED,
                  }}
                  aria-hidden
                />
              )}
              <div
                className="absolute inset-x-0"
                style={{
                  bottom: `${marksScaleMin}%`,
                  height: `${Math.max(0, marksScaleMax - marksScaleMin)}%`,
                  background: `linear-gradient(to top, ${HEAT_RED}, ${HEAT_MID}, ${HEAT_GREEN})`,
                }}
                aria-hidden
              />
              <div
                role="slider"
                aria-label="Heatmap scale maximum (green)"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={marksScaleMax}
                className={cn(
                  GRADIENT_HANDLE,
                  'border-green-600/80 dark:border-green-500/80',
                )}
                style={{
                  bottom: `${marksScaleMax}%`,
                  transform: 'translateY(50%)',
                }}
                onPointerDown={onGradientHandlePointerDown('max')}
                onPointerMove={onGradientHandlePointerMove}
                onPointerUp={onGradientHandlePointerUp}
                onPointerCancel={onGradientHandlePointerUp}
              />
              <div
                role="slider"
                aria-label="Heatmap scale minimum (red)"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={marksScaleMin}
                className={cn(
                  GRADIENT_HANDLE,
                  'border-red-600/80 dark:border-red-500/80',
                )}
                style={{
                  bottom: `${marksScaleMin}%`,
                  transform: 'translateY(50%)',
                }}
                onPointerDown={onGradientHandlePointerDown('min')}
                onPointerMove={onGradientHandlePointerMove}
                onPointerUp={onGradientHandlePointerUp}
                onPointerCancel={onGradientHandlePointerUp}
              />
            </div>
            <div className="flex h-28 flex-col justify-between">
              <label className="flex items-center gap-0.5 tabular-nums text-green-600 dark:text-green-500">
                <input
                  type="text"
                  inputMode="decimal"
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  onBlur={applyMaxInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyMaxInput()
                  }}
                  className={cn(
                    numberInputNoSpin,
                    'w-12 rounded border border-green-600/50 bg-surface px-1 py-0.5 text-right text-xs text-foreground dark:border-green-500/50',
                  )}
                  aria-label="Heatmap maximum marks percent (green)"
                />
                <span>%</span>
              </label>
              <span className="tabular-nums text-muted-foreground">
                {formatScalePercentInput(scaleMid)}%
              </span>
              <label className="flex items-center gap-0.5 tabular-nums text-red-600 dark:text-red-500">
                <input
                  type="text"
                  inputMode="decimal"
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  onBlur={applyMinInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyMinInput()
                  }}
                  className={cn(
                    numberInputNoSpin,
                    'w-12 rounded border border-red-600/50 bg-surface px-1 py-0.5 text-right text-xs text-foreground dark:border-red-500/50',
                  )}
                  aria-label="Heatmap minimum marks percent (red)"
                />
                <span>%</span>
              </label>
            </div>
          </div>
          <p className="max-w-[9rem] text-[10px] leading-snug text-muted-foreground">
            Colors clamp to this range so a tight band (e.g. 68–72) is easier
            to read.
          </p>
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background" />
              Paper
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 bg-urgency-today" />
              Now (expected grade)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
