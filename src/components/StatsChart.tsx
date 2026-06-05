import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { ChartPoint } from '@/lib/stats-scope'
import type { MarksRegression } from '@/lib/stats-prediction'
import {
  atMsFromPlotPointer,
  buildChartHoverSnapshot,
  CHART_HEIGHT,
  CHART_PAD,
  CHART_PLOT_H,
  CHART_PLOT_W,
  CHART_WIDTH,
  formatChartTimeHover,
  timePercentAxisTicks,
} from '@/lib/stats-chart-hover'
import { cn } from '@/lib/utils'

type StatsChartProps = {
  series: ChartPoint[]
  regression: MarksRegression | null
  targetTimeMinutes: number | null
  className?: string
}

const W = CHART_WIDTH
const H = CHART_HEIGHT
const PAD = CHART_PAD
const PLOT_W = CHART_PLOT_W
const PLOT_H = CHART_PLOT_H

function scale(
  value: number,
  min: number,
  max: number,
  range: number,
): number {
  if (max <= min) return range / 2
  return ((value - min) / (max - min)) * range
}

function formatAxisTime(ms: number): string {
  return format(new Date(ms), 'd MMM')
}

function timePercentAxisMax(
  series: ChartPoint[],
  hasTarget: boolean,
): number {
  const dataMax = Math.max(...series.map((p) => p.timeUsedPercent), 0)
  const raw = Math.max(hasTarget ? 100 : 0, dataMax, 25)
  return Math.ceil(raw / 25) * 25
}

export function StatsChart({
  series,
  regression,
  targetTimeMinutes,
  className,
}: StatsChartProps) {
  const gradientId = useId()
  const chartRef = useRef<HTMLDivElement>(null)
  const [hoverMs, setHoverMs] = useState<number | null>(null)
  const [tooltipLeftPct, setTooltipLeftPct] = useState(50)

  const layout = useMemo(() => {
    if (series.length === 0) return null

    const minMs = Math.min(...series.map((p) => p.atMs))
    const maxMs = Math.max(
      ...series.map((p) => p.atMs),
      regression?.curve[regression.curve.length - 1]?.atMs ?? 0,
      Date.now(),
    )
    const span = Math.max(maxMs - minMs, 3_600_000)

    const xAt = (atMs: number) =>
      PAD.left + scale(atMs, minMs, minMs + span, PLOT_W)

    const hasTarget = targetTimeMinutes !== null
    const timePercentMax = timePercentAxisMax(series, hasTarget)
    const timePercentTicks = timePercentAxisTicks(timePercentMax)

    const marksPoints = series
      .map((p) => {
        const x = xAt(p.atMs)
        const y = PAD.top + PLOT_H - scale(p.marksPercent, 0, 100, PLOT_H)
        return `${x},${y}`
      })
      .join(' ')

    const timePoints = series
      .map((p) => {
        const x = xAt(p.atMs)
        const y =
          PAD.top +
          PLOT_H -
          scale(p.timeUsedPercent, 0, timePercentMax, PLOT_H)
        return `${x},${y}`
      })
      .join(' ')

    const regressionPoints =
      regression?.curve
        .map((p) => {
          const x = xAt(p.atMs)
          const y =
            PAD.top +
            PLOT_H -
            scale(p.predictedPercent, 0, 100, PLOT_H)
          return `${x},${y}`
        })
        .join(' ') ?? ''

    const targetY = hasTarget
      ? PAD.top + PLOT_H - scale(100, 0, timePercentMax, PLOT_H)
      : null

    const tickCount = Math.min(6, Math.max(2, series.length))
    const xTicks: number[] = []
    for (let i = 0; i < tickCount; i++) {
      xTicks.push(minMs + (span * i) / (tickCount - 1))
    }

    return {
      minMs,
      span,
      xAt,
      marksPoints,
      timePoints,
      regressionPoints,
      targetY,
      timePercentMax,
      timePercentTicks,
      xTicks,
    }
  }, [series, regression, targetTimeMinutes])

  const hover = useMemo(() => {
    if (hoverMs === null || !layout) return null
    return buildChartHoverSnapshot(
      series,
      regression,
      hoverMs,
      layout.span,
    )
  }, [hoverMs, layout, series, regression])

  const clearHover = useCallback(() => setHoverMs(null), [])

  const onPlotPointer = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      if (!layout || !chartRef.current) return
      const atMs = atMsFromPlotPointer(
        clientX,
        clientY,
        svg,
        layout.minMs,
        layout.span,
      )
      setHoverMs(atMs)
      const wrap = chartRef.current.getBoundingClientRect()
      const pct = ((clientX - wrap.left) / wrap.width) * 100
      setTooltipLeftPct(Math.min(92, Math.max(8, pct)))
    },
    [layout],
  )

  if (!layout || series.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[240px] items-center justify-center rounded-md border border-border bg-surface/30 px-4 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        No practice data in this period.
      </div>
    )
  }

  const rfUnavailable = series.length < 2

  const crossX = hover ? layout.xAt(hover.atMs) : null
  const yMarks =
    hover !== null
      ? PAD.top +
        PLOT_H -
        scale(hover.marksPercent, 0, 100, PLOT_H)
      : null
  const yTime =
    hover !== null
      ? PAD.top +
        PLOT_H -
        scale(hover.timeUsedPercent, 0, layout.timePercentMax, PLOT_H)
      : null
  const yRf =
    hover?.rfPercent != null
      ? PAD.top + PLOT_H - scale(hover.rfPercent, 0, 100, PLOT_H)
      : null

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface/30 p-3',
        className,
      )}
    >
      {rfUnavailable && (
        <p className="mb-3 text-xs text-muted-foreground">
          Need 2+ papers in this period for the RF prediction line.
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-foreground" aria-hidden />
          Marks %
        </span>
        {regression && !rfUnavailable && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-5 border-t-2 border-dashed border-urgency-today"
              aria-hidden
            />
            RF ({regression.imputedTimeUsedPercent}% time used)
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-link" aria-hidden />
          Time (% used)
        </span>
        {targetTimeMinutes !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0 w-5 border-t border-dashed border-muted-foreground"
              aria-hidden
            />
            Exam target ({targetTimeMinutes} min · 100%)
          </span>
        )}
      </div>

      <div ref={chartRef} className="relative">
        {hover && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-10 max-w-[min(280px,92vw)] -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-foreground shadow-md"
            style={{ left: `${tooltipLeftPct}%`, top: 0 }}
          >
            <p className="font-medium text-foreground">{hover.dateLabel}</p>
            {hover.nearest && (
              <p className="mt-0.5 text-muted-foreground">
                {[hover.nearest.paperName, hover.nearest.unitName]
                  .filter(Boolean)
                  .join(' · ') || hover.nearest.label}
              </p>
            )}
            <dl className="mt-2 space-y-1 tabular-nums">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Marks</dt>
                <dd className="font-medium text-foreground">
                  {hover.marksPercent}%
                  {hover.interpolated && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      (interp.)
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Time</dt>
                <dd className="font-medium text-link">
                  {formatChartTimeHover(
                    hover.timeMinutes,
                    hover.timeUsedPercent,
                  )}
                </dd>
              </div>
              {targetTimeMinutes !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Target</dt>
                  <dd>
                    {targetTimeMinutes} min (100%)
                  </dd>
                </div>
              )}
              {hover.rfPercent !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">RF</dt>
                  <dd className="font-medium text-urgency-today">
                    {hover.rfPercent}%
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={cn(
            'h-auto w-full max-h-[300px]',
            hover !== null && 'cursor-crosshair',
          )}
          role="img"
          aria-label="Practice marks percentage and time chart with random forest prediction"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-foreground)"
                stopOpacity="0.08"
              />
              <stop
                offset="100%"
                stopColor="var(--color-foreground)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((tick) => {
            const y = PAD.top + PLOT_H - scale(tick, 0, 100, PLOT_H)
            return (
              <g key={`m-${tick}`}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeOpacity={0.5}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px]"
                >
                  {tick}%
                </text>
              </g>
            )
          })}

          {layout.timePercentTicks.map((tick) => {
            const y =
              PAD.top +
              PLOT_H -
              scale(tick, 0, layout.timePercentMax, PLOT_H)
            return (
              <g key={`t-${tick}`}>
                <text
                  x={PAD.left + PLOT_W + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-link text-[9px]"
                >
                  {tick}%
                </text>
              </g>
            )
          })}

          {layout.xTicks.map((ms) => {
            const x = layout.xAt(ms)
            return (
              <g key={`x-${ms}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_H}
                  stroke="var(--color-border)"
                  strokeOpacity={0.35}
                />
                <text
                  x={x}
                  y={H - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  {formatAxisTime(ms)}
                </text>
              </g>
            )
          })}

          {layout.targetY !== null && (
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={layout.targetY}
              y2={layout.targetY}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
          )}

          {regression && layout.regressionPoints && (
            <polyline
              fill="none"
              stroke="var(--color-urgency-today)"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={layout.regressionPoints}
              opacity={0.9}
            />
          )}

          <polyline
            fill="none"
            stroke="var(--color-foreground)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={layout.marksPoints}
          />
          <polyline
            fill="none"
            stroke="var(--color-link)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={layout.timePoints}
          />

          {hover && crossX !== null && yMarks !== null && yTime !== null && (
            <g aria-hidden>
              <line
                x1={crossX}
                x2={crossX}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--color-foreground)"
                strokeOpacity={0.45}
                strokeDasharray="4 3"
              />
              <circle
                cx={crossX}
                cy={yMarks}
                r={5}
                fill="var(--color-background)"
                stroke="var(--color-foreground)"
                strokeWidth={2}
              />
              <circle
                cx={crossX}
                cy={yTime}
                r={4.5}
                fill="var(--color-background)"
                stroke="var(--color-link)"
                strokeWidth={2}
              />
              {yRf !== null && (
                <circle
                  cx={crossX}
                  cy={yRf}
                  r={4.5}
                  fill="var(--color-background)"
                  stroke="var(--color-urgency-today)"
                  strokeWidth={2}
                />
              )}
            </g>
          )}

          {series.map((point) => {
            const x = layout.xAt(point.atMs)
            const yMarks =
              PAD.top + PLOT_H - scale(point.marksPercent, 0, 100, PLOT_H)
            const yTime =
              PAD.top +
              PLOT_H -
              scale(point.timeUsedPercent, 0, layout.timePercentMax, PLOT_H)
            const snapped = hover?.nearest?.key === point.key

            return (
              <g key={point.key}>
                <circle
                  cx={x}
                  cy={yMarks}
                  r={snapped ? 6 : 4}
                  fill="var(--color-background)"
                  stroke="var(--color-foreground)"
                  strokeWidth={snapped ? 2.5 : 2}
                  opacity={hover && !snapped ? 0.45 : 1}
                />
                <circle
                  cx={x}
                  cy={yTime}
                  r={snapped ? 5.5 : 3.5}
                  fill="var(--color-background)"
                  stroke="var(--color-link)"
                  strokeWidth={snapped ? 2 : 1.5}
                  opacity={hover && !snapped ? 0.45 : 1}
                />
              </g>
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
    </div>
  )
}
