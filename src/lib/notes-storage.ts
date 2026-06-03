import { z } from 'zod'
import type { NotesExportPayload, NotesState } from './notes-types'

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const formatSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
})

const textBoxSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  content: z.string(),
  zIndex: z.number().optional(),
  backgroundColor: z.string().optional(),
  highlighted: z.boolean().optional(),
  format: formatSchema.optional(),
})

const imageSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  src: z.string(),
  zIndex: z.number().optional(),
  highlighted: z.boolean().optional(),
})

const strokeSchema = z.object({
  id: z.string(),
  points: z.array(pointSchema),
  color: z.string(),
  width: z.number().positive(),
  zIndex: z.number().optional(),
  highlighted: z.boolean().optional(),
})

const exportV2Schema = z.object({
  version: z.literal(2),
  exportedAt: z.string(),
  textBoxes: z.array(textBoxSchema),
  strokes: z.array(strokeSchema),
  images: z.array(imageSchema),
})

const exportV1Schema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  textBoxes: z.array(textBoxSchema),
  strokes: z.array(strokeSchema),
})

export function normalizeNotesState(state: NotesState): NotesState {
  let z = 0
  const textBoxes = state.textBoxes.map((b) => ({
    ...b,
    zIndex: b.zIndex ?? z++,
    backgroundColor: b.backgroundColor ?? '#18181b',
  }))
  const strokes = state.strokes.map((s) => ({
    ...s,
    zIndex: s.zIndex ?? z++,
  }))
  const images = (state.images ?? []).map((i) => ({
    ...i,
    zIndex: i.zIndex ?? z++,
  }))
  return { textBoxes, strokes, images }
}

export function buildNotesExport(state: NotesState): NotesExportPayload {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    textBoxes: state.textBoxes,
    strokes: state.strokes,
    images: state.images,
  }
}

export function downloadNotesJson(state: NotesState): void {
  const payload = buildNotesExport(state)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `lockin-notes-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseNotesImport(raw: unknown): NotesExportPayload {
  const v2 = exportV2Schema.safeParse(raw)
  if (v2.success) {
    return normalizeNotesState({
      textBoxes: v2.data.textBoxes.map((b) => ({ ...b, zIndex: b.zIndex ?? 0 })),
      strokes: v2.data.strokes.map((s) => ({ ...s, zIndex: s.zIndex ?? 0 })),
      images: v2.data.images.map((i) => ({ ...i, zIndex: i.zIndex ?? 0 })),
    }) as NotesExportPayload
  }

  const v1 = exportV1Schema.parse(raw)
  const normalized = normalizeNotesState({
    textBoxes: v1.textBoxes.map((b) => ({ ...b, zIndex: b.zIndex ?? 0 })),
    strokes: v1.strokes.map((s) => ({ ...s, zIndex: s.zIndex ?? 0 })),
    images: [],
  })
  return {
    version: 2,
    exportedAt: v1.exportedAt,
    textBoxes: normalized.textBoxes,
    strokes: normalized.strokes,
    images: normalized.images,
  }
}

export function replaceNotesImport(imported: NotesExportPayload): NotesState {
  return normalizeNotesState(imported)
}

export function defaultNotesState(): NotesState {
  return { textBoxes: [], strokes: [], images: [] }
}
