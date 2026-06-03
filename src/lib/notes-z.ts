import type { DrawStroke, NoteImage, NoteTextBox } from './notes-types'

export function nextZIndex(
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[] = [],
): number {
  const maxBox = textBoxes.reduce((m, b) => Math.max(m, b.zIndex ?? 0), 0)
  const maxStroke = strokes.reduce((m, s) => Math.max(m, s.zIndex ?? 0), 0)
  const maxImage = images.reduce((m, i) => Math.max(m, i.zIndex ?? 0), 0)
  return Math.max(maxBox, maxStroke, maxImage, 0) + 1
}

export function sortByZIndex<T extends { zIndex: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.zIndex - b.zIndex)
}

type ZItem = { kind: 'box' | 'stroke' | 'image'; id: string; z: number }

function buildZList(
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[],
): ZItem[] {
  return [
    ...textBoxes.map((b) => ({ kind: 'box' as const, id: b.id, z: b.zIndex })),
    ...strokes.map((s) => ({
      kind: 'stroke' as const,
      id: s.id,
      z: s.zIndex,
    })),
    ...images.map((i) => ({
      kind: 'image' as const,
      id: i.id,
      z: i.zIndex,
    })),
  ].sort((a, b) => a.z - b.z)
}

function applyZList(
  list: ZItem[],
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[],
) {
  const zByBox = new Map<string, number>()
  const zByStroke = new Map<string, number>()
  const zByImage = new Map<string, number>()
  list.forEach((item, index) => {
    if (item.kind === 'box') zByBox.set(item.id, index)
    else if (item.kind === 'stroke') zByStroke.set(item.id, index)
    else zByImage.set(item.id, index)
  })
  return {
    textBoxes: textBoxes.map((b) => ({
      ...b,
      zIndex: zByBox.get(b.id) ?? b.zIndex,
    })),
    strokes: strokes.map((s) => ({
      ...s,
      zIndex: zByStroke.get(s.id) ?? s.zIndex,
    })),
    images: images.map((i) => ({
      ...i,
      zIndex: zByImage.get(i.id) ?? i.zIndex,
    })),
  }
}

function isSelected(
  item: ZItem,
  ids: { boxes: string[]; strokes: string[]; images: string[] },
): boolean {
  if (item.kind === 'box') return ids.boxes.includes(item.id)
  if (item.kind === 'stroke') return ids.strokes.includes(item.id)
  return ids.images.includes(item.id)
}

export function bringForward(
  ids: { boxes: string[]; strokes: string[]; images: string[] },
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[],
) {
  const list = buildZList(textBoxes, strokes, images)
  for (let i = list.length - 2; i >= 0; i--) {
    if (!isSelected(list[i], ids)) continue
    ;[list[i], list[i + 1]] = [list[i + 1], list[i]]
  }
  return applyZList(list, textBoxes, strokes, images)
}

export function sendBackward(
  ids: { boxes: string[]; strokes: string[]; images: string[] },
  textBoxes: NoteTextBox[],
  strokes: DrawStroke[],
  images: NoteImage[],
) {
  const list = buildZList(textBoxes, strokes, images)
  for (let i = 1; i < list.length; i++) {
    if (!isSelected(list[i], ids)) continue
    ;[list[i], list[i - 1]] = [list[i - 1], list[i]]
  }
  return applyZList(list, textBoxes, strokes, images)
}
