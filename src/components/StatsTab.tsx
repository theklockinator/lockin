import { useMemo, useState, type ReactNode } from 'react'
import { Activity, Target, Timer, TrendingUp } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import {
  analyzeRfTrends,
  GRADE_TREND_LABELS,
  TIME_TREND_LABELS,
  type GradeTrendId,
  type TimeTrendId,
} from '@/lib/rf-trend'
import { GradeBoundariesPanel } from '@/components/GradeBoundariesEditor'
import { Button } from '@/components/ui/button'
import { StatsChart } from '@/components/StatsChart'
import { StatsRfSurface } from '@/components/StatsRfSurface'
import { percentToGrade, resolveGradeMinPercent } from '@/lib/grade-boundaries'
import {
  buildMarksRegression,
  expectedGradeFromRegression,
  fallbackPredictPercent,
  formatHoursUntil,
  formatPracticeRate,
  hoursToTargetFromRows,
  practicePercentPerHour,
} from '@/lib/stats-prediction'
import { useExamStore } from '@/store/useExamStore'
import { useGradeStore } from '@/store/useGradeStore'
import { useLockinStore } from '@/store/useLockinStore'
import {
  STATS_SCOPES,
  buildChartSeries,
  computeScopeSummary,
  matchExamForUnit,
  scopedPapers,
  unitBreakdown,
  type StatsScope,
} from '@/lib/stats-scope'
import { cn } from '@/lib/utils'

export function StatsTab() {
  const units = useLockinStore((s) => s.units)
  const streak = useLockinStore((s) => s.streak)
  const exams = useExamStore((s) => s.exams)
  const boundaries = useGradeStore((s) => s.boundaries)

  const [scope, setScope] = useState<StatsScope>('month')
  const [unitId, setUnitId] = useState<string | 'all'>('all')
  const [boundariesOpen, setBoundariesOpen] = useState(false)

  const sortedUnits = useMemo(
    () => [...units].sort((a, b) => a.sortOrder - b.sortOrder),
    [units],
  )

  const rows = useMemo(
    () => scopedPapers(units, scope, unitId),
    [units, scope, unitId],
  )
  const summary = useMemo(
    () => computeScopeSummary(units, scope, unitId),
    [units, scope, unitId],
  )
  const series = useMemo(() => buildChartSeries(rows), [rows])
  const regression = useMemo(() => buildMarksRegression(rows), [rows])
  const rfTrends = useMemo(() => analyzeRfTrends(regression), [regression])
  const breakdown = useMemo(
    () =>
      unitId === 'all'
        ? unitBreakdown(units, scope, boundaries, exams)
        : [],
    [units, scope, unitId, boundaries, exams],
  )

  const gradeInfo = useMemo(() => {
    const fromRf = expectedGradeFromRegression(regression, boundaries)
    if (fromRf) return fromRf
    const pct = fallbackPredictPercent(rows)
    if (pct === null) return null
    return {
      grade: percentToGrade(pct, boundaries).grade,
      percent: pct,
    }
  }, [regression, boundaries, rows])

  const examTarget = useMemo(() => {
    if (unitId === 'all' || sortedUnits.length === 0) return null
    const unit = sortedUnits.find((u) => u.id === unitId)
    if (!unit) return null
    return matchExamForUnit(unit, exams)
  }, [unitId, sortedUnits, exams])

  const practiceRate = useMemo(
    () => practicePercentPerHour(regression, rows),
    [regression, rows],
  )

  const hoursToTarget = useMemo(() => {
    if (!examTarget) return null
    const min = resolveGradeMinPercent(examTarget.targetGrade, boundaries)
    if (min === null) return null
    return hoursToTargetFromRows(rows, min)
  }, [examTarget, boundaries, rows])

  if (units.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Add units and practice papers on the Track tab to see statistics.
      </p>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Period</p>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Statistics period"
          >
            {STATS_SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  scope === s.id
                    ? 'border-foreground bg-foreground text-primary-foreground'
                    : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block min-w-[10rem] space-y-1 text-xs text-muted-foreground">
          Unit
          <select
            value={unitId}
            onChange={(e) =>
              setUnitId(
                e.target.value === 'all' ? 'all' : e.target.value,
              )
            }
            className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="all">All units</option>
            {sortedUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {unitId === 'all' && (
        <p className="rounded-md border border-border bg-surface/50 px-3 py-2 text-xs text-muted-foreground">
          All-units view pools papers together; RF and targets are less reliable.
          Select a single unit for more accurate stats, practice rate, and time
          to target.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Expected grade"
          value={gradeInfo?.grade ?? '—'}
          detail={
            gradeInfo
              ? `${gradeInfo.percent}% RF from ${Math.round((regression?.nowPoint.hours ?? 0) * 10) / 10} practice hr logged in this scope (avg ${regression?.imputedTimeUsedPercent ?? '—'}% time used) — not a forecast of future study`
              : 'Need 2+ papers for regression'
          }
          highlight
          footer={
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="-mx-2 mt-1 min-h-9 px-2 py-1.5 text-xs font-medium text-primary underline-offset-4 hover:bg-primary/10 hover:text-primary hover:underline"
              onClick={() => setBoundariesOpen(true)}
            >
              Change grade boundaries
            </Button>
          }
        />
        <SummaryCard
          label="Papers"
          value={String(summary.paperCount)}
          detail={
            summary.totalPracticeMinutes > 0
              ? `${summary.totalPracticeMinutes} min total`
              : '—'
          }
        />
        <SummaryCard
          label="Avg score"
          value={
            summary.avgMarksPercent !== null
              ? `${summary.avgMarksPercent}%`
              : '—'
          }
          detail={
            summary.bestMarksPercent !== null
              ? `Range ${summary.worstMarksPercent}–${summary.bestMarksPercent}%`
              : '—'
          }
        />
        <SummaryCard
          label="Avg time"
          value={
            summary.avgTimeMinutes !== null
              ? `${summary.avgTimeMinutes} min`
              : '—'
          }
          detail={
            summary.avgVsExamDuration !== null &&
            summary.targetExamDuration !== null
              ? `${summary.avgVsExamDuration > 0 ? '+' : ''}${summary.avgVsExamDuration} min vs ${summary.targetExamDuration} min target`
              : '—'
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard
          icon={TrendingUp}
          title="Grade trend"
          body={
            <TrendStatBody
              kind="grade"
              id={rfTrends.grade}
              detail={rfTrends.gradeDetail}
              hint="Marks % along the RF curve vs cumulative practice hours"
            />
          }
        />
        <InsightCard
          icon={Activity}
          title="Time trend"
          body={
            <TrendStatBody
              kind="time"
              id={rfTrends.time}
              detail={rfTrends.timeDetail}
              hint="Whether you finish papers faster or slower over practice — not how high % time is vs the exam"
            />
          }
        />
        <InsightCard
          icon={Target}
          title="Quota days"
          body={
            scope === 'all' ? (
              <span className="text-sm text-muted-foreground">
                Pick a bounded period to track quota days.
              </span>
            ) : (
              <p className="text-sm tabular-nums text-foreground">
                <span className="text-2xl font-semibold">
                  {summary.quotaDaysMet}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  / {summary.quotaDaysInScope} days on quota
                </span>
              </p>
            )
          }
        />
        <InsightCard
          icon={Timer}
          title="Streak"
          body={
            <p className="text-sm text-foreground">
              <span className="text-2xl font-semibold tabular-nums">
                {streak.current}
              </span>
              <span className="text-muted-foreground"> day current</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Best {streak.longest} · all-units perfect days
              </span>
            </p>
          }
        />
      </div>

      {unitId !== 'all' && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Practice rate</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatPracticeRate(practiceRate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              RF marks % change from first to last paper in scope (per practice
              hour) — separate from time-trend % used
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Time to target grade
              {examTarget ? ` (${examTarget.targetGrade})` : ''}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {examTarget ? formatHoursUntil(hoursToTarget) : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {examTarget
                ? `Estimated practice hours until RF predicts ${examTarget.targetGrade} boundary`
                : 'Set a target grade on a matching exam'}
            </p>
          </div>
        </div>
      )}

      {regression && rows.length >= 2 ? (
        <StatsRfSurface regression={regression} />
      ) : rows.length > 0 ? (
        <div className="rounded-md border border-border bg-surface/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Add at least 2 papers in this period to show the random forest
          heatmap.
        </div>
      ) : null}

      <div>
        <h2 className="mb-1 text-sm font-medium text-foreground">
          Marks & time
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          X-axis is calendar date when each paper was done. The RF line uses
          cumulative practice hours between papers (see heatmap above).
        </p>
        <StatsChart
          series={series}
          regression={regression}
          targetTimeMinutes={
            unitId === 'all' ? null : summary.targetExamDuration
          }
        />
      </div>

      {breakdown.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-foreground">By unit</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Click a row to filter the chart and heatmap to that unit.
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/80 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Papers</th>
                  <th className="px-3 py-2 font-medium">Avg marks</th>
                  <th className="px-3 py-2 font-medium">% time used</th>
                  <th className="px-3 py-2 font-medium">RF %</th>
                  <th className="px-3 py-2 font-medium">Avg time</th>
                  <th className="px-3 py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr
                    key={row.unitId}
                    className="cursor-pointer border-b border-border/60 hover:bg-surface-elevated/30"
                    onClick={() => setUnitId(row.unitId)}
                  >
                    <td className="px-3 py-2 font-medium">{row.unitName}</td>
                    <td className="px-3 py-2 tabular-nums">{row.paperCount}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.avgMarksPercent !== null
                        ? `${row.avgMarksPercent}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.avgTimeUsedPercent !== null
                        ? `${row.avgTimeUsedPercent}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.rfPercent !== null ? `${row.rfPercent}%` : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.timeDisplay}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {row.gradeDisplay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={boundariesOpen}
        onClose={() => setBoundariesOpen(false)}
        title="Grade boundaries"
      >
        <GradeBoundariesPanel />
      </Dialog>
    </section>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  highlight = false,
  footer,
}: {
  label: string
  value: string
  detail: string
  highlight?: boolean
  footer?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        highlight
          ? 'border-panel-tint-border bg-panel-tint'
          : 'border-border bg-surface/50',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          highlight ? 'text-panel-tint-text' : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      {footer}
    </div>
  )
}

function InsightCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof TrendingUp
  title: string
  body: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </div>
      {body}
    </div>
  )
}

const GRADE_TREND_COLOR: Record<GradeTrendId, string> = {
  improving: 'text-success-foreground',
  declining: 'text-urgency-soon',
  stable: 'text-foreground',
  volatile: 'text-urgency-today',
  'sudden-rise': 'text-success-foreground',
  'sudden-decline': 'text-urgency-soon',
  'occasional-luck': 'text-muted-foreground',
  insufficient: 'text-muted-foreground',
}

const TIME_TREND_COLOR: Record<TimeTrendId, string> = {
  'steady-pace': 'text-foreground',
  'getting-faster': 'text-success-foreground',
  'getting-slower': 'text-urgency-soon',
  insufficient: 'text-muted-foreground',
}

function TrendStatBody({
  kind,
  id,
  detail,
  hint,
}: {
  kind: 'grade' | 'time'
  id: GradeTrendId | TimeTrendId
  detail: string
  hint: string
}) {
  const label =
    kind === 'grade' ? GRADE_TREND_LABELS[id as GradeTrendId] : TIME_TREND_LABELS[id as TimeTrendId]
  const color =
    kind === 'grade'
      ? GRADE_TREND_COLOR[id as GradeTrendId]
      : TIME_TREND_COLOR[id as TimeTrendId]

  if (id === 'insufficient') {
    return (
      <div>
        <p className="text-sm text-muted-foreground">{detail}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </div>
    )
  }

  return (
    <div className={cn('text-sm', color)}>
      <p className="text-lg font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      <p className="mt-2 text-xs text-muted-foreground/80">{hint}</p>
    </div>
  )
}
