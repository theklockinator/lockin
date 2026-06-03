import { addDays, format, isAfter, parseISO, subDays } from 'date-fns'
import { allQuotasMet } from './stats'
import type { StreakState, Unit } from './types'

function earliestPaperDate(units: Unit[]): string | null {
  let earliest: string | null = null
  for (const unit of units) {
    for (const paper of unit.practicePapers) {
      if (!earliest || paper.date < earliest) earliest = paper.date
    }
  }
  return earliest
}

export function computeLongestStreak(units: Unit[]): number {
  if (units.length === 0) return 0

  const earliest = earliestPaperDate(units)
  if (!earliest) return 0

  let longest = 0
  let run = 0
  let cursor = parseISO(earliest)
  const end = new Date()

  while (!isAfter(cursor, end)) {
    const dateStr = format(cursor, 'yyyy-MM-dd')
    if (allQuotasMet(units, dateStr)) {
      run++
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
    cursor = addDays(cursor, 1)
  }

  return longest
}

function computeCurrentStreak(units: Unit[]): {
  current: number
  lastPerfectDate: string | null
} {
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayPerfect = allQuotasMet(units, today)

  let current = 0
  let lastPerfectDate: string | null = null
  let cursor = todayPerfect ? new Date() : subDays(new Date(), 1)

  while (true) {
    const dateStr = format(cursor, 'yyyy-MM-dd')
    if (!allQuotasMet(units, dateStr)) break
    current++
    lastPerfectDate = dateStr
    cursor = subDays(cursor, 1)
  }

  return { current, lastPerfectDate }
}

export function computeStreak(units: Unit[]): StreakState {
  if (units.length === 0) {
    return { current: 0, longest: 0, lastPerfectDate: null }
  }

  const { current, lastPerfectDate } = computeCurrentStreak(units)
  const longest = Math.max(computeLongestStreak(units), current)

  return { current, longest, lastPerfectDate }
}
