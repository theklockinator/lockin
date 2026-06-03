import { describe, expect, it } from 'vitest'
import {
  buildAppExport,
  mergeAppBackup,
  parseAppBackup,
  replaceAppBackup,
} from './app-backup'
import { defaultStreak } from './storage'

describe('app-backup', () => {
  it('exports and parses v2 with notes and exams', () => {
    const snapshot = {
      track: {
        units: [],
        streak: defaultStreak(),
      },
      notes: {
        textBoxes: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 120,
            height: 80,
            content: 'hi',
            zIndex: 0,
          },
        ],
        strokes: [],
        images: [],
      },
      exams: [
        {
          id: 'e1',
          name: 'Physics',
          durationMinutes: 90,
          maxMarks: 100,
          marksAchieved: null,
          scheduledAt: '2026-06-15T14:00',
          location: 'Hall A',
          links: [],
          subject: 'Physics',
          paperCode: '9PH0',
          seatNumber: '',
          materials: '',
          status: 'upcoming' as const,
          targetGrade: 'A',
          notes: '',
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }

    const payload = buildAppExport(snapshot)
    const parsed = parseAppBackup(payload)

    expect(parsed.version).toBe(2)
    expect(parsed.notes.textBoxes).toHaveLength(1)
    expect(parsed.exams).toHaveLength(1)

    const replaced = replaceAppBackup(parsed)
    expect(replaced.notes.textBoxes[0].content).toBe('hi')
    expect(replaced.exams[0].name).toBe('Physics')
  })

  it('upgrades v1 track-only backups', () => {
    const v1 = {
      version: 1 as const,
      exportedAt: '2026-01-01T00:00:00.000Z',
      units: [],
      streak: defaultStreak(),
    }
    const parsed = parseAppBackup(v1)
    expect(parsed.notes.textBoxes).toEqual([])
    expect(parsed.exams).toEqual([])
  })

  it('merges notes and exams by id', () => {
    const current = {
      track: { units: [], streak: defaultStreak() },
      notes: {
        textBoxes: [
          { id: 'a', x: 0, y: 0, width: 10, height: 10, content: '', zIndex: 0 },
        ],
        strokes: [],
        images: [],
      },
      exams: [
        {
          id: 'e1',
          name: 'Existing',
          durationMinutes: 60,
          maxMarks: 80,
          marksAchieved: null,
          scheduledAt: '2026-06-01T09:00',
          location: '',
          links: [],
          subject: '',
          paperCode: '',
          seatNumber: '',
          materials: '',
          status: 'upcoming' as const,
          targetGrade: '',
          notes: '',
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }

    const imported = buildAppExport({
      track: current.track,
      notes: {
        textBoxes: [
          { id: 'a', x: 0, y: 0, width: 10, height: 10, content: 'dup', zIndex: 0 },
          { id: 'b', x: 1, y: 1, width: 10, height: 10, content: 'new', zIndex: 1 },
        ],
        strokes: [],
        images: [],
      },
      exams: [
        ...current.exams,
        {
          id: 'e2',
          name: 'New exam',
          durationMinutes: 60,
          maxMarks: 80,
          marksAchieved: null,
          scheduledAt: '2026-07-01T09:00',
          location: '',
          links: [],
          subject: '',
          paperCode: '',
          seatNumber: '',
          materials: '',
          status: 'upcoming' as const,
          targetGrade: '',
          notes: '',
          sortOrder: 1,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    })

    const merged = mergeAppBackup(current, imported)
    expect(merged.notes.textBoxes).toHaveLength(2)
    expect(merged.exams).toHaveLength(2)
  })
})
