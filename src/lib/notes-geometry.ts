import type { DrawPoint, DrawStroke, NoteImage, NoteTextBox } from './notes-types'
import {
  NOTES_CANVAS_INITIAL_HEIGHT,
  NOTES_CANVAS_INITIAL_WIDTH,
  NOTES_CANVAS_PADDING,
} from './notes-types'

export type Rect = { x: number; y: number; w: number; h: number }

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function textBoxRect(box: NoteTextBox): Rect {
  return { x: box.x, y: box.y, w: box.width, h: box.height }
}

export function imageRect(img: NoteImage): Rect {
  return { x: img.x, y: img.y, w: img.width, h: img.height }
}

export function computeNotesCanvasSize(
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[],
  draftPoints: DrawPoint[] = [],
): { width: number; height: number } {
  let maxRight = 0
  let maxBottom = 0

  for (const box of textBoxes) {
    maxRight = Math.max(maxRight, box.x + box.width)
    maxBottom = Math.max(maxBottom, box.y + box.height)
  }
  for (const img of images) {
    maxRight = Math.max(maxRight, img.x + img.width)
    maxBottom = Math.max(maxBottom, img.y + img.height)
  }
  for (const stroke of strokes) {
    const bounds = strokeBounds(stroke)
    if (bounds) {
      maxRight = Math.max(maxRight, bounds.x + bounds.w)
      maxBottom = Math.max(maxBottom, bounds.y + bounds.h)
    }
  }
  for (const p of draftPoints) {
    maxRight = Math.max(maxRight, p.x)
    maxBottom = Math.max(maxBottom, p.y)
  }

  return {
    width: Math.max(
      NOTES_CANVAS_INITIAL_WIDTH,
      maxRight + NOTES_CANVAS_PADDING,
    ),
    height: Math.max(
      NOTES_CANVAS_INITIAL_HEIGHT,
      maxBottom + NOTES_CANVAS_PADDING,
    ),
  }
}

export function translateStroke(
  stroke: DrawStroke,
  dx: number,
  dy: number,
): DrawStroke {
  return {
    ...stroke,
    points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }
}

export function strokeBounds(stroke: DrawStroke): Rect | null {
  if (stroke.points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const pad = stroke.width + 4
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  }
}

const MIN_RESIZE_SCALE = 0.05
const MAX_RESIZE_SCALE = 50

/**
 * SE-corner resize: top-left of startBounds stays fixed; bottom-right follows pointer
 * delta from anchorPointer (pointer at drag start → identity scale).
 */
export function scaleStrokeFromCorner(
  stroke: DrawStroke,
  startBounds: Rect,
  pointerX: number,
  pointerY: number,
  anchorPointerX: number,
  anchorPointerY: number,
  lockAspect = false,
): DrawStroke {
  const { width: newW, height: newH } = sizeFromCornerResize(
    startBounds.w,
    startBounds.h,
    pointerX,
    pointerY,
    anchorPointerX,
    anchorPointerY,
    lockAspect,
    8,
    8,
  )
  const safeW = Math.max(1, startBounds.w)
  const safeH = Math.max(1, startBounds.h)
  let sx = newW / safeW
  let sy = newH / safeH
  sx = Math.min(MAX_RESIZE_SCALE, Math.max(MIN_RESIZE_SCALE, sx))
  sy = Math.min(MAX_RESIZE_SCALE, Math.max(MIN_RESIZE_SCALE, sy))
  const ax = startBounds.x
  const ay = startBounds.y
  const widthScale = (sx + sy) / 2
  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      x: ax + (p.x - ax) * sx,
      y: ay + (p.y - ay) * sy,
    })),
    width: Math.max(0.5, stroke.width * widthScale),
  }
}

export function sizeFromCornerResize(
  startW: number,
  startH: number,
  pointerX: number,
  pointerY: number,
  anchorX: number,
  anchorY: number,
  lockAspect: boolean,
  minW: number,
  minH: number,
): { width: number; height: number } {
  let width = Math.max(minW, startW + (pointerX - anchorX))
  let height = Math.max(minH, startH + (pointerY - anchorY))
  if (lockAspect && startW > 0 && startH > 0) {
    const scale = Math.max(width / startW, height / startH)
    width = startW * scale
    height = startH * scale
  }
  return { width, height }
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

export function hitTestStroke(
  px: number,
  py: number,
  stroke: DrawStroke,
  threshold = 10,
): boolean {
  const pts = stroke.points
  if (pts.length === 0) return false
  if (pts.length === 1) {
    return Math.hypot(px - pts[0].x, py - pts[0].y) <= threshold
  }
  for (let i = 1; i < pts.length; i++) {
    const d = distToSegment(
      px,
      py,
      pts[i - 1].x,
      pts[i - 1].y,
      pts[i].x,
      pts[i].y,
    )
    if (d <= threshold + stroke.width / 2) return true
  }
  return false
}

export function hitTestStrokeNearPoint(
  px: number,
  py: number,
  strokes: DrawStroke[],
  radius: number,
): string[] {
  return strokes
    .filter((s) => hitTestStroke(px, py, s, radius))
    .map((s) => s.id)
}

export function boxesAtPoint(
  px: number,
  py: number,
  textBoxes: NoteTextBox[],
): NoteTextBox[] {
  return textBoxes
    .filter((b) => pointInRect(px, py, textBoxRect(b)))
    .sort((a, b) => b.zIndex - a.zIndex)
}

export function imagesAtPoint(
  px: number,
  py: number,
  images: NoteImage[],
): NoteImage[] {
  return images
    .filter((img) => pointInRect(px, py, imageRect(img)))
    .sort((a, b) => b.zIndex - a.zIndex)
}

export function selectInRect(
  rect: Rect,
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[],
): { boxIds: string[]; strokeIds: string[]; imageIds: string[] } {
  const boxIds = textBoxes
    .filter((b) => rectsIntersect(rect, textBoxRect(b)))
    .map((b) => b.id)
  const strokeIds = strokes
    .filter((s) => {
      const b = strokeBounds(s)
      return b && rectsIntersect(rect, b)
    })
    .map((s) => s.id)
  const imageIds = images
    .filter((img) => rectsIntersect(rect, imageRect(img)))
    .map((img) => img.id)
  return { boxIds, strokeIds, imageIds }
}

export function cloneNotesState(state: {
  textBoxes: NoteTextBox[]
  strokes: DrawStroke[]
  images?: NoteImage[]
}) {
  return {
    textBoxes: state.textBoxes.map((b) => ({ ...b, format: b.format ? { ...b.format } : undefined })),
    strokes: state.strokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    })),
    images: (state.images ?? []).map((i) => ({ ...i })),
  }
}
