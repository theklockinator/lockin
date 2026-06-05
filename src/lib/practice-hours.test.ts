import { describe, expect, it } from 'vitest'
import {
  cumulativePracticeHours,
  practiceHoursAtMs,
  totalPracticeHours,
} from './practice-hours'

describe('practice-hours', () => {
  it('sums minutes into cumulative hours', () => {
    const rows = [
      { atMs: 0, timeMinutes: 60 },
      { atMs: 1000, timeMinutes: 30 },
    ]
    expect(cumulativePracticeHours(rows)).toEqual([1, 1.5])
    expect(totalPracticeHours(rows)).toBe(1.5)
  })

  it('interpolates hours between papers and holds after last', () => {
    const rows = [
      { atMs: 0, timeMinutes: 60 },
      { atMs: 3600_000, timeMinutes: 60 },
    ]
    expect(practiceHoursAtMs(rows, -1)).toBe(0)
    expect(practiceHoursAtMs(rows, 0)).toBe(1)
    expect(practiceHoursAtMs(rows, 1800_000)).toBe(1.5)
    expect(practiceHoursAtMs(rows, 7200_000)).toBe(2)
  })
})
