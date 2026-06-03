import { format, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import {
  allQuotasMet,
  papersOnDate,
  quotaMet,
  rollingAvgMarks,
  rollingAvgTime,
  scorePercent,
} from './stats'
import { computeLongestStreak, computeStreak } from './streak'
import type { Unit } from './types'

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1',
    name: 'Math',
    examDurationMinutes: 90,
    maxMarks: 100,
    dailyQuota: 2,
    rollingN: 3,
    practicePapers: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides,
  }
}

function paper(
  id: string,
  date: string,
  overrides: Partial<{ timeMinutes: number; marks: number }> = {},
) {
  return {
    id,
    date,
    timeMinutes: 80,
    marks: 80,
    ...overrides,
  }
}

describe('stats', () => {
  it('computes rolling average from last n papers', () => {
    const unit = makeUnit({
      rollingN: 3,
      practicePapers: [
        { id: '1', date: '2026-06-01', timeMinutes: 80, marks: 70 },
        { id: '2', date: '2026-06-02', timeMinutes: 90, marks: 80 },
        { id: '3', date: '2026-06-03', timeMinutes: 100, marks: 90 },
        { id: '4', date: '2026-06-04', timeMinutes: 60, marks: 60 },
      ],
    })
    expect(rollingAvgMarks(unit)).toBe(76.7)
    expect(rollingAvgTime(unit)).toBe(83.3)
  })

  it('respects adjustable n', () => {
    const unit = makeUnit({
      rollingN: 2,
      practicePapers: [
        { id: '1', date: '2026-06-01', timeMinutes: 80, marks: 70 },
        { id: '2', date: '2026-06-02', timeMinutes: 90, marks: 80 },
        { id: '3', date: '2026-06-03', timeMinutes: 100, marks: 90 },
        { id: '4', date: '2026-06-04', timeMinutes: 60, marks: 60 },
      ],
    })
    expect(rollingAvgMarks(unit)).toBe(75)
    expect(rollingAvgTime(unit)).toBe(80)
  })

  it('averages fewer than n papers when not enough history', () => {
    const unit = makeUnit({
      practicePapers: [
        { id: '1', date: '2026-06-01', timeMinutes: 80, marks: 80 },
      ],
    })
    expect(rollingAvgMarks(unit)).toBe(80)
    expect(rollingAvgTime(unit)).toBe(80)
  })

  it('tracks daily quota', () => {
    const unit = makeUnit({
      dailyQuota: 2,
      practicePapers: [
        { id: '1', date: '2026-06-02', timeMinutes: 80, marks: 80 },
        { id: '2', date: '2026-06-02', timeMinutes: 90, marks: 85 },
      ],
    })
    expect(papersOnDate(unit, '2026-06-02')).toBe(2)
    expect(quotaMet(unit, '2026-06-02')).toBe(true)
  })

  it('computes score percent', () => {
    expect(scorePercent(75, 100)).toBe(75)
  })
})

describe('streak', () => {
  it('requires all units to meet quota', () => {
    const units = [
      makeUnit({
        id: 'a',
        dailyQuota: 1,
        practicePapers: [paper('1', '2026-06-01')],
      }),
      makeUnit({
        id: 'b',
        sortOrder: 1,
        dailyQuota: 1,
        practicePapers: [],
      }),
    ]
    expect(allQuotasMet(units, '2026-06-01')).toBe(false)
  })

  it('returns zero streak with no units', () => {
    expect(computeStreak([])).toEqual({
      current: 0,
      longest: 0,
      lastPerfectDate: null,
    })
  })

  it('finds longest streak across history', () => {
    const d1 = format(subDays(new Date(), 4), 'yyyy-MM-dd')
    const d2 = format(subDays(new Date(), 3), 'yyyy-MM-dd')
    const d3 = format(subDays(new Date(), 2), 'yyyy-MM-dd')
    const gap = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const d5 = format(new Date(), 'yyyy-MM-dd')

    const units = [
      makeUnit({
        dailyQuota: 1,
        practicePapers: [
          paper('1', d1),
          paper('2', d2),
          paper('3', d3),
          paper('4', d5),
        ],
      }),
    ]
    // d1-d3 = 3-day run; gap day breaks it; d5 alone = 1
    expect(computeLongestStreak(units)).toBe(3)
    expect(allQuotasMet(units, gap)).toBe(false)
  })

  it('recomputes longest downward when a perfect day is removed', () => {
    const d1 = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const d2 = format(new Date(), 'yyyy-MM-dd')

    const units = [
      makeUnit({
        dailyQuota: 1,
        practicePapers: [paper('1', d1), paper('2', d2)],
      }),
    ]
    expect(computeLongestStreak(units)).toBe(2)

    const afterDelete = [
      makeUnit({
        dailyQuota: 1,
        practicePapers: [paper('1', d1)],
      }),
    ]
    expect(computeLongestStreak(afterDelete)).toBe(1)
  })
})
