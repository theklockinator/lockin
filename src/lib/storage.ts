import { z } from 'zod'
import { normalizePaper } from './paper-datetime'
import { computeStreak } from './streak'
import type { AppState, ExportPayload, StreakState, Unit } from './types'
import { DEFAULT_ROLLING_N, MAX_ROLLING_N, MIN_ROLLING_N } from './types'

const practicePaperSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  completedAt: z.string().optional(),
  date: z.string().optional(),
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

const exportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  units: z.array(unitSchema),
  streak: streakSchema,
})

export function buildExportPayload(state: AppState): ExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    units: state.units,
    streak: state.streak,
  }
}

export function downloadJson(state: AppState): void {
  const payload = buildExportPayload(state)
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

function normalizeImportedUnit(unit: z.infer<typeof unitSchema>): Unit {
  const n = unit.rollingN ?? DEFAULT_ROLLING_N
  return {
    ...unit,
    rollingN: Math.min(
      MAX_ROLLING_N,
      Math.max(MIN_ROLLING_N, Math.floor(n)),
    ),
    practicePapers: unit.practicePapers.map((paper) => normalizePaper(paper)),
  }
}

export function parseImportFile(raw: unknown): ExportPayload {
  const parsed = exportSchema.parse(raw)
  return {
    ...parsed,
    units: parsed.units.map(normalizeImportedUnit),
  }
}

export function mergeImport(
  current: AppState,
  imported: ExportPayload,
): AppState {
  const existingIds = new Set(current.units.map((u) => u.id))
  const mergedUnits: Unit[] = [
    ...current.units,
    ...imported.units.filter((u) => !existingIds.has(u.id)),
  ]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 20)

  return { units: mergedUnits, streak: computeStreak(mergedUnits) }
}

export function replaceImport(imported: ExportPayload): AppState {
  const units = imported.units.slice(0, 20)
  return { units, streak: computeStreak(units) }
}

export function defaultStreak(): StreakState {
  return { current: 0, longest: 0, lastPerfectDate: null }
}
