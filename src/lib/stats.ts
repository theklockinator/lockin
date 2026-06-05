import { format } from 'date-fns'
import { paperDate } from './paper-datetime'
import type { PracticePaper, Unit } from './types'
import { DEFAULT_ROLLING_N, MAX_ROLLING_N, MIN_ROLLING_N } from './types'

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function papersOnDate(unit: Unit, date: string): number {
  return unit.practicePapers.filter((p) => paperDate(p) === date).length
}

export function quotaMet(unit: Unit, date: string): boolean {
  return papersOnDate(unit, date) >= unit.dailyQuota
}

export function allQuotasMet(units: Unit[], date: string): boolean {
  if (units.length === 0) return false
  return units.every((u) => quotaMet(u, date))
}

export function scorePercent(marks: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0
  return Math.round((marks / maxMarks) * 100)
}

export function sortedPapers(unit: Unit): PracticePaper[] {
  return [...unit.practicePapers].sort((a, b) => {
    const atCmp = b.completedAt.localeCompare(a.completedAt)
    if (atCmp !== 0) return atCmp
    return b.id.localeCompare(a.id)
  })
}

export function effectiveRollingN(unit: Unit): number {
  const n = unit.rollingN ?? DEFAULT_ROLLING_N
  return Math.min(MAX_ROLLING_N, Math.max(MIN_ROLLING_N, Math.floor(n)))
}

export function recentPapersForAverage(unit: Unit): PracticePaper[] {
  return sortedPapers(unit).slice(0, effectiveRollingN(unit))
}

export function rollingAvgMarks(unit: Unit): number | null {
  const recent = recentPapersForAverage(unit)
  if (recent.length === 0) return null
  const sum = recent.reduce((acc, p) => acc + p.marks, 0)
  return Math.round((sum / recent.length) * 10) / 10
}

export function rollingAvgTime(unit: Unit): number | null {
  const recent = recentPapersForAverage(unit)
  if (recent.length === 0) return null
  const sum = recent.reduce((acc, p) => acc + p.timeMinutes, 0)
  return Math.round((sum / recent.length) * 10) / 10
}

export function rollingSampleCount(unit: Unit): number {
  return recentPapersForAverage(unit).length
}

export function timeDelta(avg: number | null, target: number): number | null {
  if (avg === null) return null
  return Math.round((avg - target) * 10) / 10
}

export function unitsOnQuotaToday(units: Unit[]): number {
  const today = todayStr()
  return units.filter((u) => quotaMet(u, today)).length
}
