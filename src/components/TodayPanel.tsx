import { useLockinStore } from '@/store/useLockinStore'
import {
  papersOnDate,
  quotaMet,
  todayStr,
  unitsOnQuotaToday,
} from '@/lib/stats'
import { cn } from '@/lib/utils'

export function TodayPanel() {
  const units = useLockinStore((s) => s.units)
  const today = todayStr()

  if (units.length === 0) return null

  const onQuota = unitsOnQuotaToday(units)
  const allMet = onQuota === units.length

  return (
    <section className="rounded-lg border border-border bg-surface/50 px-4 py-3">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="text-sm text-foreground">
          <span className={cn('tabular-nums', allMet && 'text-success-foreground')}>
            {onQuota}/{units.length}
          </span>{' '}
          units on quota today
        </p>
        {allMet && (
          <span className="text-xs text-success-foreground">all done</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {[...units]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((unit) => {
            const count = papersOnDate(unit, today)
            const met = quotaMet(unit, today)
            return (
              <span
                key={unit.id}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs tabular-nums',
                  met
                    ? 'border-success/40 bg-success/20 text-success-foreground'
                    : 'border-border bg-surface-elevated text-foreground',
                )}
              >
                {unit.name} {count}/{unit.dailyQuota}
              </span>
            )
          })}
      </div>
    </section>
  )
}
