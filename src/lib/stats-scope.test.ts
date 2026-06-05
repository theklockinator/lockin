import { describe, expect, it } from 'vitest'
import { percentToGrade } from './grade-boundaries'
import {
  buildChartSeries,
  computeScopeSummary,
  isPaperInScope,
  scopedPapers,
} from './stats-scope'
import type { Unit } from './types'

function unit(
  id: string,
  papers: Unit['practicePapers'],
  overrides: Partial<Unit> = {},
): Unit {
  return {
    id,
    name: id === 'u1' ? 'Physics' : 'Math',
    examDurationMinutes: 90,
    maxMarks: 100,
    dailyQuota: 1,
    rollingN: 3,
    practicePapers: papers,
    createdAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides,
  }
}

const now = new Date('2026-06-15T14:00:00')

describe('stats-scope', () => {
  it('filters papers by week scope using datetime', () => {
    const u = unit('u1', [
      {
        id: '1',
        name: '',
        completedAt: '2026-06-15T10:00',
        timeMinutes: 80,
        marks: 80,
      },
      {
        id: '2',
        name: '',
        completedAt: '2026-06-01T10:00',
        timeMinutes: 90,
        marks: 70,
      },
    ])
    expect(scopedPapers([u], 'week', 'all', now)).toHaveLength(1)
    expect(isPaperInScope(u.practicePapers[1]!, 'week', now)).toBe(false)
  })

  it('summarizes marks and quota days', () => {
    const u = unit('u1', [
      {
        id: '1',
        name: 'P1',
        completedAt: '2026-06-14T09:00',
        timeMinutes: 80,
        marks: 85,
      },
      {
        id: '2',
        name: 'P2',
        completedAt: '2026-06-15T11:00',
        timeMinutes: 90,
        marks: 75,
      },
    ])
    const summary = computeScopeSummary([u], 'week', 'u1', now)
    expect(summary.paperCount).toBe(2)
    expect(summary.avgMarksPercent).toBe(80)
    expect(summary.quotaDaysMet).toBe(2)
  })

  it('maps percent to editable grades', () => {
    expect(percentToGrade(92, [{ grade: 'A*', minPercent: 90 }]).grade).toBe(
      'A*',
    )
  })

  it('chart series uses real timestamps', () => {
    const u = unit('u1', [
      {
        id: '1',
        name: '',
        completedAt: '2026-06-14T09:00',
        timeMinutes: 80,
        marks: 70,
      },
      {
        id: '2',
        name: '',
        completedAt: '2026-06-15T11:00',
        timeMinutes: 80,
        marks: 80,
      },
    ])
    const series = buildChartSeries(scopedPapers([u], 'month', 'u1', now))
    expect(series[0]!.atMs).toBeLessThan(series[1]!.atMs)
  })
})
