import { z } from 'zod'
import type { Exam } from './exam-types'
import { MAX_EXAMS } from './exam-types'
import { normalizeNotesState } from './notes-storage'
import type { NotesExportPayload, NotesState } from './notes-types'
import { mergeImport, replaceImport } from './storage'
import type { AppState, ExportPayload, StreakState, Unit } from './types'
import { DEFAULT_ROLLING_N, MAX_ROLLING_N, MIN_ROLLING_N } from './types'

const practicePaperSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeMinutes: z.number().min(0),
  marks: z.number().min(0),
})

const unitSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  examDurationMinutes: z.number().positive(),
  maxMarks: z.number().positive(),
  dailyQuota: z.number().positive(),
  rollingN: z.number().int().positive().optional(),
  practicePapers: z.array(practicePaperSchema),
  createdAt: z.string(),
  sortOrder: z.number(),
})

const streakSchema = z.object({
  current: z.number().min(0),
  longest: z.number().min(0),
  lastPerfectDate: z.string().nullable(),
})

const notesStateSchema = z.object({
  textBoxes: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      content: z.string(),
      zIndex: z.number().optional(),
      backgroundColor: z.string().optional(),
      highlighted: z.boolean().optional(),
      format: z
        .object({
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          underline: z.boolean().optional(),
          fontSize: z.number().optional(),
          color: z.string().optional(),
        })
        .optional(),
    }),
  ),
  strokes: z.array(
    z.object({
      id: z.string(),
      points: z.array(z.object({ x: z.number(), y: z.number() })),
      color: z.string(),
      width: z.number().positive(),
      zIndex: z.number().optional(),
      highlighted: z.boolean().optional(),
    }),
  ),
  images: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      src: z.string(),
      zIndex: z.number().optional(),
      highlighted: z.boolean().optional(),
    }),
  ),
})

const examLinkSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string(),
})

const examSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  durationMinutes: z.number().positive(),
  maxMarks: z.number().positive(),
  marksAchieved: z.number().min(0).nullable().optional(),
  scheduledAt: z.string().min(1),
  location: z.string(),
  links: z.array(examLinkSchema),
  subject: z.string(),
  paperCode: z.string(),
  seatNumber: z.string(),
  materials: z.string(),
  status: z.enum(['upcoming', 'completed', 'cancelled']),
  targetGrade: z.string(),
  notes: z.string(),
  sortOrder: z.number(),
  createdAt: z.string(),
})

const trackExportV1Schema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  units: z.array(unitSchema),
  streak: streakSchema,
})

const appExportV2Schema = z.object({
  version: z.literal(2),
  exportedAt: z.string(),
  units: z.array(unitSchema),
  streak: streakSchema,
  notes: notesStateSchema,
  exams: z.array(examSchema),
})

export type AppExportPayload = {
  version: 2
  exportedAt: string
  units: Unit[]
  streak: StreakState
  notes: NotesState
  exams: Exam[]
}

export type AppBackupSnapshot = {
  track: AppState
  notes: NotesState
  exams: Exam[]
}

function normalizeImportedUnit(unit: z.infer<typeof unitSchema>): Unit {
  const n = unit.rollingN ?? DEFAULT_ROLLING_N
  return {
    ...unit,
    rollingN: Math.min(
      MAX_ROLLING_N,
      Math.max(MIN_ROLLING_N, Math.floor(n)),
    ),
  }
}

function normalizeExams(
  exams: Array<Omit<Exam, 'marksAchieved'> & { marksAchieved?: number | null }>,
): Exam[] {
  return [...exams]
    .map(
      (exam): Exam => ({
        ...exam,
        marksAchieved: exam.marksAchieved ?? null,
      }),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((exam, index) => ({ ...exam, sortOrder: index }))
    .slice(0, MAX_EXAMS)
}

function isNotesOnlyExport(
  raw: Record<string, unknown>,
): raw is NotesExportPayload & Record<string, unknown> {
  return (
    raw.version === 2 &&
    Array.isArray(raw.textBoxes) &&
    !('units' in raw)
  )
}

export function buildAppExport(snapshot: AppBackupSnapshot): AppExportPayload {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    units: snapshot.track.units,
    streak: snapshot.track.streak,
    notes: {
      textBoxes: snapshot.notes.textBoxes,
      strokes: snapshot.notes.strokes,
      images: snapshot.notes.images ?? [],
    },
    exams: snapshot.exams,
  }
}

export function downloadAppBackup(snapshot: AppBackupSnapshot): void {
  const payload = buildAppExport(snapshot)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `lockin-backup-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseAppBackup(raw: unknown): AppExportPayload {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid backup')
  }
  const record = raw as Record<string, unknown>

  if (isNotesOnlyExport(record)) {
    throw new Error(
      'This is a notes-only file. Import it from the Notes tab, or use a full lockin backup.',
    )
  }

  const v2 = appExportV2Schema.safeParse(raw)
  if (v2.success) {
    return {
      version: 2,
      exportedAt: v2.data.exportedAt,
      units: v2.data.units.map(normalizeImportedUnit),
      streak: v2.data.streak,
      notes: normalizeNotesState({
        textBoxes: v2.data.notes.textBoxes.map((b, i) => ({
          ...b,
          zIndex: b.zIndex ?? i,
        })),
        strokes: v2.data.notes.strokes.map((s, i) => ({
          ...s,
          zIndex: s.zIndex ?? i,
        })),
        images: v2.data.notes.images.map((img, i) => ({
          ...img,
          zIndex: img.zIndex ?? i,
        })),
      }),
      exams: normalizeExams(v2.data.exams),
    }
  }

  const v1 = trackExportV1Schema.parse(raw)
  return {
    version: 2,
    exportedAt: v1.exportedAt,
    units: v1.units.map(normalizeImportedUnit),
    streak: v1.streak,
    notes: { textBoxes: [], strokes: [], images: [] },
    exams: [],
  }
}

function toTrackExport(payload: AppExportPayload): ExportPayload {
  return {
    version: 1,
    exportedAt: payload.exportedAt,
    units: payload.units,
    streak: payload.streak,
  }
}

export function replaceAppBackup(payload: AppExportPayload): AppBackupSnapshot {
  const track = replaceImport(toTrackExport(payload))
  return {
    track,
    notes: normalizeNotesState(payload.notes),
    exams: normalizeExams(payload.exams),
  }
}

export function mergeAppBackup(
  current: AppBackupSnapshot,
  payload: AppExportPayload,
): AppBackupSnapshot {
  const track = mergeImport(current.track, toTrackExport(payload))

  const boxIds = new Set(current.notes.textBoxes.map((b) => b.id))
  const strokeIds = new Set(current.notes.strokes.map((s) => s.id))
  const imageIds = new Set((current.notes.images ?? []).map((i) => i.id))
  const examIds = new Set(current.exams.map((e) => e.id))

  const notes = normalizeNotesState({
    textBoxes: [
      ...current.notes.textBoxes,
      ...payload.notes.textBoxes.filter((b) => !boxIds.has(b.id)),
    ],
    strokes: [
      ...current.notes.strokes,
      ...payload.notes.strokes.filter((s) => !strokeIds.has(s.id)),
    ],
    images: [
      ...(current.notes.images ?? []),
      ...payload.notes.images.filter((i) => !imageIds.has(i.id)),
    ],
  })

  const exams = normalizeExams([
    ...current.exams,
    ...payload.exams.filter((e) => !examIds.has(e.id)),
  ])

  return { track, notes, exams }
}
