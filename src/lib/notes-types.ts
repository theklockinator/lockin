export type TextBoxFormat = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  color?: string
}

export type NoteTextBox = {
  id: string
  x: number
  y: number
  width: number
  height: number
  content: string
  zIndex: number
  backgroundColor?: string
  highlighted?: boolean
  format?: TextBoxFormat
}

export type NoteImage = {
  id: string
  x: number
  y: number
  width: number
  height: number
  src: string
  zIndex: number
  highlighted?: boolean
}

export type DrawPoint = {
  x: number
  y: number
}

export type DrawStroke = {
  id: string
  points: DrawPoint[]
  color: string
  width: number
  zIndex: number
  highlighted?: boolean
}

export type NotesState = {
  textBoxes: NoteTextBox[]
  strokes: DrawStroke[]
  images: NoteImage[]
}

export type NotesExportPayload = {
  version: 2
  exportedAt: string
  textBoxes: NoteTextBox[]
  strokes: DrawStroke[]
  images: NoteImage[]
}

export type NotesTool =
  | 'pan'
  | 'edit'
  | 'insert'
  | 'text'
  | 'draw'
  | 'color'
export type DrawSubTool = 'pen' | 'eraser'
export type EraserMode = 'stroke' | 'pixel'

export type NotesEditorSettings = {
  drawColor: string
  highlightColor: string
  textBackgroundColor: string
  textColor: string
  eraserMode: EraserMode
  eraserDiameter: number
  drawSize: number
  highlightWidth: number
}

export const DEFAULT_EDITOR_SETTINGS: NotesEditorSettings = {
  drawColor: '#d4d4d8',
  highlightColor: '#f59e0b',
  textBackgroundColor: '#18181b',
  textColor: '#fafafa',
  eraserMode: 'stroke',
  eraserDiameter: 14,
  drawSize: 2,
  highlightWidth: 6,
}

/** Default canvas size when empty or smaller than content. */
export const NOTES_CANVAS_INITIAL_WIDTH = 1200
export const NOTES_CANVAS_INITIAL_HEIGHT = 900
/** Minimum empty margin on each side; content near an edge grows the canvas. */
export const NOTES_CANVAS_PADDING = 80

/** @deprecated Use NOTES_CANVAS_INITIAL_WIDTH */
export const NOTES_CANVAS_WIDTH = NOTES_CANVAS_INITIAL_WIDTH
/** @deprecated Use NOTES_CANVAS_INITIAL_HEIGHT */
export const NOTES_CANVAS_HEIGHT = NOTES_CANVAS_INITIAL_HEIGHT

export const MIN_BOX_WIDTH = 100
export const MIN_BOX_HEIGHT = 72
export const MIN_IMAGE_SIZE = 40
