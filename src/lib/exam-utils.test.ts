import { describe, expect, it } from 'vitest'
import {
  daysUntilExam,
  formatDaysLeft,
  parseLinksText,
  sortedExams,
} from './exam-utils'
import type { Exam } from './exam-types'

function exam(overrides: Partial<Exam> = {}): Exam {
  return {
    id: '1',
    name: 'Test',
    durationMinutes: 90,
    maxMarks: 100,
    marksAchieved: null,
    scheduledAt: '2026-06-15T09:00',
    location: '',
    links: [],
    subject: '',
    paperCode: '',
    seatNumber: '',
    materials: '',
    status: 'upcoming',
    targetGrade: '',
    notes: '',
    sortOrder: 0,
    createdAt: '',
    ...overrides,
  }
}

describe('exam-utils', () => {
  it('sorts exams by scheduled date', () => {
    const a = exam({ id: 'a', scheduledAt: '2026-06-20T09:00' })
    const b = exam({ id: 'b', scheduledAt: '2026-06-10T09:00' })
    expect(sortedExams([a, b]).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('formats days left labels', () => {
    const now = new Date('2026-06-14T12:00:00')
    expect(formatDaysLeft('2026-06-14T09:00', 'upcoming', now)).toBe('Today')
    expect(formatDaysLeft('2026-06-15T09:00', 'upcoming', now)).toBe('Tomorrow')
    expect(daysUntilExam('2026-06-20T09:00', now)).toBe(6)
  })

  it('parses link lines', () => {
    const links = parseLinksText('Spec | https://example.com\nhttps://other.com')
    expect(links).toHaveLength(2)
    expect(links[0].label).toBe('Spec')
    expect(links[0].url).toBe('https://example.com')
  })
})
