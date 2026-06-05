import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { formatShortcut } from '@/lib/notes-format-shortcuts'
import {
  boxesAtPoint,
  computeNotesCanvasSize,
  hitTestStroke,
  hitTestStrokeNearPoint,
  imagesAtPoint,
  normalizeRect,
  scaleStrokeFromCorner,
  selectInRect,
  sizeFromCornerResize,
  strokeBounds,
  translateStroke,
  type Rect,
} from '@/lib/notes-geometry'
import { erasePointsInRadius, renderStrokes } from '@/lib/notes-draw'
import {
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
  MIN_IMAGE_SIZE,
  type DrawPoint,
  type DrawStroke,
  type DrawSubTool,
  type NoteImage,
  type NoteTextBox,
  type NotesEditorSettings,
  type NotesTool,
  type TextBoxFormat,
} from '@/lib/notes-types'
import { bringForward, nextZIndex, sendBackward, sortByZIndex } from '@/lib/notes-z'
import { useNotesHistory } from '@/hooks/useNotesHistory'
import { cn, generateId } from '@/lib/utils'
import { useNotesStore } from '@/store/useNotesStore'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

type Clipboard = {
  textBoxes: NoteTextBox[]
  strokes: ReturnType<typeof useNotesStore.getState>['strokes']
  images: NoteImage[]
}

type ResizeRef =
  | {
      kind: 'box' | 'image'
      id: string
      startW: number
      startH: number
      originX: number
      originY: number
    }
  | {
      kind: 'stroke'
      id: string
      startBounds: Rect
      originX: number
      originY: number
      originalStroke: DrawStroke
    }

function cloneStroke(stroke: DrawStroke): DrawStroke {
  return {
    ...stroke,
    points: stroke.points.map((p) => ({ ...p })),
  }
}

function isMod(e: { metaKey: boolean; ctrlKey: boolean }) {
  return e.metaKey || e.ctrlKey
}

type PickModifier = 'none' | 'shift'

function pickModifierFromEvent(e: { shiftKey: boolean }): PickModifier {
  return e.shiftKey ? 'shift' : 'none'
}

const PAN_CLICK_SLOP_PX = 5

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
}

function boxTextStyle(
  box: NoteTextBox,
  settings: NotesEditorSettings,
): React.CSSProperties {
  const f = box.format
  const color = f?.color ?? settings.textColor
  return {
    fontWeight: f?.bold ? 'bold' : 'normal',
    fontStyle: f?.italic ? 'italic' : 'normal',
    textDecoration: f?.underline ? 'underline' : 'none',
    fontSize: f?.fontSize ?? 14,
    color,
    ['--note-placeholder' as string]: `color-mix(in srgb, ${color} 28%, transparent)`,
  }
}

export type NotesCanvasHandle = {
  applyColorsToSelected: () => void
  addTextBox: (x?: number, y?: number) => void
  insertImage: (src: string, naturalWidth: number, naturalHeight: number) => void
  toggleFormatKey: (key: 'bold' | 'italic' | 'underline') => void
  setFontSize: (size: number) => void
}

export const NotesCanvas = forwardRef<
  NotesCanvasHandle,
  {
    tool: NotesTool
    drawSubTool: DrawSubTool
    settings: NotesEditorSettings
    zoom: number
    onZoomChange: (z: number) => void
    onSelectionChange?: (has: boolean) => void
    onTextTargetsChange?: (has: boolean) => void
  }
>(function NotesCanvas(
  {
    tool,
    drawSubTool,
    settings,
    zoom,
    onZoomChange,
    onSelectionChange,
    onTextTargetsChange,
  },
  ref,
) {
  const textBoxes = useNotesStore((s) => s.textBoxes)
  const strokes = useNotesStore((s) => s.strokes)
  const images = useNotesStore((s) => s.images ?? [])
  const { commit, undo, redo, snapshot } = useNotesHistory()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([])
  const drawingRef = useRef(false)
  const erasingIdsRef = useRef<Set<string>>(new Set())
  const pixelEraserBaseRef = useRef<typeof strokes | null>(null)
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(
    null,
  )
  const panPendingRef = useRef<{
    clientX: number
    clientY: number
    canvX: number
    canvY: number
    modifier: PickModifier
    panning: boolean
  } | null>(null)
  const editDragRef = useRef<{
    startX: number
    startY: number
    curX: number
    curY: number
    marqueeActive: boolean
    shiftKey: boolean
  } | null>(null)
  const boxDragRef = useRef<{
    id: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const imageDragRef = useRef<{
    id: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const strokeDragRef = useRef<{
    id: string
    startPoints: DrawPoint[]
    startX: number
    startY: number
  } | null>(null)
  const resizeRef = useRef<ResizeRef | null>(null)
  const resizePointerRef = useRef<{
    x: number
    y: number
    shiftKey: boolean
  } | null>(null)
  const boxClickCycleRef = useRef<{
    x: number
    y: number
    ids: string[]
    index: number
  } | null>(null)
  const clipboardRef = useRef<Clipboard | null>(null)
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set())
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(
    new Set(),
  )
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set(),
  )
  const [focusedBoxId, setFocusedBoxId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<ReturnType<typeof normalizeRect> | null>(
    null,
  )
  const [draftStrokePoints, setDraftStrokePoints] = useState<DrawPoint[]>([])

  const canvasSize = useMemo(
    () =>
      computeNotesCanvasSize(
        textBoxes,
        strokes,
        images,
        draftStrokePoints,
      ),
    [textBoxes, strokes, images, draftStrokePoints],
  )
  const canvasWidth = canvasSize.width
  const canvasHeight = canvasSize.height

  const hasSelection =
    selectedBoxIds.size > 0 ||
    selectedStrokeIds.size > 0 ||
    selectedImageIds.size > 0

  const hasTextTargets =
    focusedBoxId !== null ||
    selectedBoxIds.size > 0

  useEffect(() => {
    onSelectionChange?.(hasSelection)
  }, [hasSelection, onSelectionChange])

  useEffect(() => {
    onTextTargetsChange?.(hasTextTargets)
  }, [hasTextTargets, onTextTargetsChange])

  const clearSelection = useCallback(() => {
    setSelectedBoxIds(new Set())
    setSelectedStrokeIds(new Set())
    setSelectedImageIds(new Set())
  }, [])

  const setSelection = useCallback(
    (boxIds: string[], strokeIds: string[], imageIds: string[] = []) => {
      setSelectedBoxIds(new Set(boxIds))
      setSelectedStrokeIds(new Set(strokeIds))
      setSelectedImageIds(new Set(imageIds))
    },
    [],
  )

  const selectAll = useCallback(() => {
    setSelection(
      textBoxes.map((b) => b.id),
      strokes.map((s) => s.id),
      images.map((i) => i.id),
    )
  }, [textBoxes, strokes, images, setSelection])

  const pointerToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const el = surfaceRef.current ?? canvasRef.current
      if (!el) return { x: 0, y: 0 }
      const rect = el.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * canvasWidth,
        y: ((clientY - rect.top) / rect.height) * canvasHeight,
      }
    },
    [canvasWidth, canvasHeight],
  )

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderStrokes(ctx, strokes, {
      highlightColor: settings.highlightColor,
      highlightWidth: settings.highlightWidth,
      width: canvasWidth,
      height: canvasHeight,
    })
  }, [
    strokes,
    settings.highlightColor,
    settings.highlightWidth,
    canvasWidth,
    canvasHeight,
  ])

  useEffect(() => {
    redraw()
  }, [redraw])

  const placeTextBox = useCallback(
    (canv: { x: number; y: number }) => {
      const cur = snapshot()
      const z = nextZIndex(cur.textBoxes, cur.strokes, cur.images)
      const box: NoteTextBox = {
        id: generateId(),
        x: Math.max(0, canv.x - 20),
        y: Math.max(0, canv.y - 20),
        width: 220,
        height: 120,
        content: '',
        zIndex: z,
        backgroundColor: settings.textBackgroundColor,
        format: { color: settings.textColor, fontSize: 14 },
      }
      commit({ ...cur, textBoxes: [...cur.textBoxes, box] })
      setSelection([box.id], [], [])
      setFocusedBoxId(box.id)
    },
    [commit, settings, setSelection, snapshot],
  )

  const placeImage = useCallback(
    (
      src: string,
      naturalWidth: number,
      naturalHeight: number,
      canv?: { x: number; y: number },
    ) => {
      const maxW = 400
      const scale = Math.min(1, maxW / naturalWidth)
      const w = Math.max(MIN_IMAGE_SIZE, naturalWidth * scale)
      const h = Math.max(MIN_IMAGE_SIZE, naturalHeight * scale)
      const cur = snapshot()
      const z = nextZIndex(cur.textBoxes, cur.strokes, cur.images)
      const cx = canv?.x ?? canvasWidth / 2 - w / 2
      const cy = canv?.y ?? canvasHeight / 2 - h / 2
      const img: NoteImage = {
        id: generateId(),
        x: Math.max(0, cx - w / 2),
        y: Math.max(0, cy - h / 2),
        width: w,
        height: h,
        src,
        zIndex: z,
      }
      commit({ ...cur, images: [...cur.images, img] })
      setSelection([], [], [img.id])
    },
    [commit, setSelection, snapshot, canvasWidth, canvasHeight],
  )

  const pickBoxAt = useCallback(
    (px: number, py: number, modifier: PickModifier) => {
      const hits = boxesAtPoint(px, py, textBoxes)
      if (hits.length === 0) return false

      const ids = hits.map((h) => h.id)
      const prev = boxClickCycleRef.current
      const sameSpot =
        prev &&
        Math.hypot(px - prev.x, py - prev.y) < 10 &&
        prev.ids.join() === ids.join()

      const index = sameSpot ? (prev.index + 1) % hits.length : 0
      boxClickCycleRef.current = { x: px, y: py, ids, index }
      const pick = hits[index]

      if (modifier === 'shift') {
        const next = new Set(selectedBoxIds)
        if (next.has(pick.id)) next.delete(pick.id)
        else next.add(pick.id)
        setSelectedBoxIds(next)
      } else {
        setSelection([pick.id], [], [])
      }
      return true
    },
    [textBoxes, selectedBoxIds, setSelection],
  )

  const pickImageAt = useCallback(
    (px: number, py: number, modifier: PickModifier) => {
      const hits = imagesAtPoint(px, py, images)
      if (hits.length === 0) return false
      const pick = hits[0]!
      if (modifier === 'shift') {
        const next = new Set(selectedImageIds)
        if (next.has(pick.id)) next.delete(pick.id)
        else next.add(pick.id)
        setSelectedImageIds(next)
      } else {
        setSelection([], [], [pick.id])
      }
      return true
    },
    [images, selectedImageIds, setSelection],
  )

  const pickAt = useCallback(
    (px: number, py: number, modifier: PickModifier): boolean => {
      if (pickBoxAt(px, py, modifier)) return true
      if (pickImageAt(px, py, modifier)) return true

      const sortedStrokes = sortByZIndex(strokes)
      const stroke = [...sortedStrokes]
        .reverse()
        .find((s) => hitTestStroke(px, py, s))
      if (stroke) {
        if (modifier === 'shift') {
          const next = new Set(selectedStrokeIds)
          if (next.has(stroke.id)) next.delete(stroke.id)
          else next.add(stroke.id)
          setSelectedStrokeIds(next)
        } else {
          setSelection([], [stroke.id], [])
        }
        return true
      }
      if (modifier === 'none') clearSelection()
      return false
    },
    [pickBoxAt, pickImageAt, strokes, clearSelection, setSelection],
  )

  const deleteSelected = useCallback(() => {
    if (!hasSelection) return
    const cur = snapshot()
    commit({
      textBoxes: cur.textBoxes.filter((b) => !selectedBoxIds.has(b.id)),
      strokes: cur.strokes.filter((s) => !selectedStrokeIds.has(s.id)),
      images: cur.images.filter((i) => !selectedImageIds.has(i.id)),
    })
    clearSelection()
    setFocusedBoxId(null)
  }, [
    commit,
    hasSelection,
    selectedBoxIds,
    selectedStrokeIds,
    selectedImageIds,
    snapshot,
    clearSelection,
  ])

  const highlightSelected = useCallback(() => {
    if (!hasSelection) return
    const cur = snapshot()
    const selectedItems = [
      ...cur.textBoxes.filter((b) => selectedBoxIds.has(b.id)),
      ...cur.strokes.filter((s) => selectedStrokeIds.has(s.id)),
      ...cur.images.filter((i) => selectedImageIds.has(i.id)),
    ]
    const anyHighlighted = selectedItems.some((i) => i.highlighted)
    const allHighlighted = selectedItems.every((i) => i.highlighted)
    const nextHighlighted =
      anyHighlighted && !allHighlighted ? true : !allHighlighted

    commit({
      textBoxes: cur.textBoxes.map((b) =>
        selectedBoxIds.has(b.id) ? { ...b, highlighted: nextHighlighted } : b,
      ),
      strokes: cur.strokes.map((s) =>
        selectedStrokeIds.has(s.id)
          ? { ...s, highlighted: nextHighlighted }
          : s,
      ),
      images: cur.images.map((i) =>
        selectedImageIds.has(i.id)
          ? { ...i, highlighted: nextHighlighted }
          : i,
      ),
    })
  }, [
    commit,
    hasSelection,
    selectedBoxIds,
    selectedStrokeIds,
    selectedImageIds,
    snapshot,
  ])

  const applyColorsToSelected = useCallback(() => {
    if (!hasSelection) return
    const cur = snapshot()
    commit({
      textBoxes: cur.textBoxes.map((b) =>
        selectedBoxIds.has(b.id)
          ? {
              ...b,
              backgroundColor: settings.textBackgroundColor,
              format: {
                ...b.format,
                color: settings.textColor,
              },
              highlighted: true,
            }
          : b,
      ),
      strokes: cur.strokes.map((s) =>
        selectedStrokeIds.has(s.id)
          ? { ...s, color: settings.drawColor, highlighted: true }
          : s,
      ),
      images: cur.images,
    })
  }, [
    commit,
    hasSelection,
    selectedBoxIds,
    selectedStrokeIds,
    settings,
    snapshot,
  ])

  const targetBoxIds = useCallback(() => {
    if (focusedBoxId) return [focusedBoxId]
    return [...selectedBoxIds]
  }, [focusedBoxId, selectedBoxIds])

  const toggleFormatKey = useCallback(
    (key: keyof Pick<TextBoxFormat, 'bold' | 'italic' | 'underline'>) => {
      const ids = targetBoxIds()
      if (ids.length === 0) return
      const cur = snapshot()
      commit({
        ...cur,
        textBoxes: cur.textBoxes.map((b) => {
          if (!ids.includes(b.id)) return b
          const prev = b.format?.[key] ?? false
          return {
            ...b,
            format: { ...b.format, [key]: !prev },
          }
        }),
      })
    },
    [commit, snapshot, targetBoxIds],
  )

  const setFontSize = useCallback(
    (fontSize: number) => {
      const ids = targetBoxIds()
      if (ids.length === 0) return
      const cur = snapshot()
      commit({
        ...cur,
        textBoxes: cur.textBoxes.map((b) =>
          ids.includes(b.id)
            ? { ...b, format: { ...b.format, fontSize } }
            : b,
        ),
      })
    },
    [commit, snapshot, targetBoxIds],
  )

  useImperativeHandle(
    ref,
    () => ({
      applyColorsToSelected,
      addTextBox: (x, y) => {
        if (x !== undefined && y !== undefined) {
          placeTextBox({ x, y })
        }
      },
      insertImage: (src, naturalWidth, naturalHeight) => {
        placeImage(src, naturalWidth, naturalHeight)
      },
      toggleFormatKey,
      setFontSize,
    }),
    [
      applyColorsToSelected,
      placeTextBox,
      placeImage,
      toggleFormatKey,
      setFontSize,
    ],
  )

  const reorderZ = useCallback(
    (direction: 'up' | 'down') => {
      if (!hasSelection) return
      const cur = snapshot()
      const ids = {
        boxes: [...selectedBoxIds],
        strokes: [...selectedStrokeIds],
        images: [...selectedImageIds],
      }
      const next =
        direction === 'up'
          ? bringForward(ids, cur.textBoxes, cur.strokes, cur.images)
          : sendBackward(ids, cur.textBoxes, cur.strokes, cur.images)
      commit({ ...cur, ...next })
    },
    [
      commit,
      hasSelection,
      selectedBoxIds,
      selectedStrokeIds,
      selectedImageIds,
      snapshot,
    ],
  )

  const copySelected = useCallback(() => {
    const cur = snapshot()
    clipboardRef.current = {
      textBoxes: cur.textBoxes
        .filter((b) => selectedBoxIds.has(b.id))
        .map((b) => ({ ...b, format: b.format ? { ...b.format } : undefined })),
      strokes: cur.strokes
        .filter((s) => selectedStrokeIds.has(s.id))
        .map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })),
      images: cur.images
        .filter((i) => selectedImageIds.has(i.id))
        .map((i) => ({ ...i })),
    }
  }, [selectedBoxIds, selectedStrokeIds, selectedImageIds, snapshot])

  const cutSelected = useCallback(() => {
    copySelected()
    deleteSelected()
  }, [copySelected, deleteSelected])

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current
    if (
      !clip ||
      (clip.textBoxes.length === 0 &&
        clip.strokes.length === 0 &&
        clip.images.length === 0)
    ) {
      return
    }
    const offset = 24
    const cur = snapshot()
    let z = nextZIndex(cur.textBoxes, cur.strokes, cur.images)
    const newBoxIds: string[] = []
    const newStrokeIds: string[] = []
    const newImageIds: string[] = []
    const pastedBoxes = clip.textBoxes.map((b) => {
      const id = generateId()
      newBoxIds.push(id)
      return {
        ...b,
        id,
        x: b.x + offset,
        y: b.y + offset,
        zIndex: z++,
        highlighted: false,
      }
    })
    const pastedStrokes = clip.strokes.map((s) => {
      const id = generateId()
      newStrokeIds.push(id)
      return {
        ...s,
        id,
        points: s.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
        highlighted: false,
        zIndex: z++,
      }
    })
    const pastedImages = clip.images.map((i) => {
      const id = generateId()
      newImageIds.push(id)
      return {
        ...i,
        id,
        x: i.x + offset,
        y: i.y + offset,
        zIndex: z++,
        highlighted: false,
      }
    })
    commit({
      textBoxes: [...cur.textBoxes, ...pastedBoxes],
      strokes: [...cur.strokes, ...pastedStrokes],
      images: [...cur.images, ...pastedImages],
    })
    setSelection(newBoxIds, newStrokeIds, newImageIds)
  }, [commit, setSelection, snapshot])

  const pasteImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result as string
        const img = new Image()
        img.onload = () => placeImage(src, img.naturalWidth, img.naturalHeight)
        img.src = src
      }
      reader.readAsDataURL(file)
    },
    [placeImage],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (tool === 'pan' || tool === 'draw' || tool === 'color') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        pasteImageFile(file)
        return
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pasteImageFile, tool])

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    const mod = isMod(e)

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
      return
    }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
      return
    }

    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault()
      onZoomChange(clampZoom(zoom + ZOOM_STEP))
      return
    }
    if (mod && e.key === '-') {
      e.preventDefault()
      onZoomChange(clampZoom(zoom - ZOOM_STEP))
      return
    }

    if (tool === 'edit' && hasTextTargets) {
      formatShortcut(
        e.nativeEvent,
        () => toggleFormatKey('bold'),
        () => toggleFormatKey('italic'),
        () => toggleFormatKey('underline'),
      )
    }

    if (tool === 'edit' && mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      reorderZ(e.key === 'ArrowUp' ? 'up' : 'down')
      return
    }

    if ((tool === 'edit' || tool === 'insert') && mod && e.key === 'a') {
      if ((e.target as HTMLElement).closest('textarea')) return
      e.preventDefault()
      selectAll()
      return
    }

    if (e.shiftKey && e.code === 'KeyH') {
      if ((e.target as HTMLElement).closest('textarea')) return
      if (!hasSelection) return
      e.preventDefault()
      highlightSelected()
      return
    }

    if (tool !== 'edit' && tool !== 'insert') return

    if (mod && e.key === 'c') {
      e.preventDefault()
      copySelected()
      return
    }
    if (mod && e.key === 'x') {
      e.preventDefault()
      cutSelected()
      return
    }
    if (mod && e.key === 'v') {
      if ((e.target as HTMLElement).closest('textarea')) return
      e.preventDefault()
      pasteClipboard()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if ((e.target as HTMLElement).closest('textarea')) return
      e.preventDefault()
      deleteSelected()
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!isMod(e)) return
    e.preventDefault()
    onZoomChange(clampZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))
  }

  const finishPenStroke = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const points = currentStrokeRef.current
    currentStrokeRef.current = []
    setDraftStrokePoints([])
    if (points.length < 2) {
      redraw()
      return
    }
    const cur = snapshot()
    commit({
      ...cur,
      strokes: [
        ...cur.strokes,
        {
          id: generateId(),
          points,
          color: settings.drawColor,
          width: settings.drawSize,
          zIndex: nextZIndex(cur.textBoxes, cur.strokes, cur.images),
        },
      ],
    })
  }

  const finishEraser = () => {
    if (settings.eraserMode === 'pixel') {
      const base = pixelEraserBaseRef.current
      pixelEraserBaseRef.current = null
      const cur = snapshot()
      if (base && JSON.stringify(base) !== JSON.stringify(cur.strokes)) {
        commit({ ...cur, strokes: cur.strokes })
      }
      return
    }
    if (erasingIdsRef.current.size === 0) return
    const ids = erasingIdsRef.current
    erasingIdsRef.current = new Set()
    const cur = snapshot()
    commit({
      ...cur,
      strokes: cur.strokes.filter((s) => !ids.has(s.id)),
    })
  }

  const runEraserAt = (canv: { x: number; y: number }) => {
    const radius = settings.eraserDiameter
    if (settings.eraserMode === 'stroke') {
      hitTestStrokeNearPoint(canv.x, canv.y, strokes, radius).forEach((id) =>
        erasingIdsRef.current.add(id),
      )
      return
    }
    if (!pixelEraserBaseRef.current) {
      pixelEraserBaseRef.current = snapshot().strokes
    }
    const base = pixelEraserBaseRef.current
    const next = erasePointsInRadius(base, canv.x, canv.y, radius)
    useNotesStore.setState({ strokes: next })
  }

  const handleSurfacePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    if ((e.target as HTMLElement).closest('[data-top-bar]')) return
    if ((e.target as HTMLElement).closest('[data-stroke-drag]')) return
    if ((e.target as HTMLElement).closest('textarea')) return

    const canv = pointerToCanvas(e.clientX, e.clientY)
    surfaceRef.current?.focus({ preventScroll: true })

    if (tool === 'color') {
      pickAt(canv.x, canv.y, pickModifierFromEvent(e))
      return
    }

    if (tool === 'pan') {
      panPendingRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        canvX: canv.x,
        canvY: canv.y,
        modifier: pickModifierFromEvent(e),
        panning: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    if (tool === 'insert') {
      const modifier = pickModifierFromEvent(e)
      if (modifier === 'shift') {
        pickAt(canv.x, canv.y, modifier)
        return
      }
      if (!pickAt(canv.x, canv.y, modifier)) {
        placeTextBox(canv)
      }
      return
    }

    if (tool === 'edit') {
      const pickMod = pickModifierFromEvent(e)
      if (pickMod === 'shift') {
        pickAt(canv.x, canv.y, pickMod)
        return
      }

      const hitSelectedStroke = [...sortByZIndex(strokes)]
        .reverse()
        .find(
          (s) =>
            selectedStrokeIds.has(s.id) &&
            hitTestStroke(canv.x, canv.y, s),
        )
      if (hitSelectedStroke) {
        strokeDragRef.current = {
          id: hitSelectedStroke.id,
          startPoints: hitSelectedStroke.points.map((p) => ({ ...p })),
          startX: canv.x,
          startY: canv.y,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      editDragRef.current = {
        startX: canv.x,
        startY: canv.y,
        curX: canv.x,
        curY: canv.y,
        marqueeActive: false,
        shiftKey: e.shiftKey,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    if (tool === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId)
      if (drawSubTool === 'eraser') {
        runEraserAt(canv)
        return
      }
      drawingRef.current = true
      currentStrokeRef.current = [canv]
      setDraftStrokePoints([canv])
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = settings.drawColor
        ctx.lineWidth = settings.drawSize
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(canv.x, canv.y)
      }
    }
  }

  const handleSurfacePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const canv = pointerToCanvas(e.clientX, e.clientY)

    if (panPendingRef.current && !panPendingRef.current.panning) {
      const pending = panPendingRef.current
      if (
        Math.hypot(e.clientX - pending.clientX, e.clientY - pending.clientY) >=
        PAN_CLICK_SLOP_PX
      ) {
        const container = containerRef.current
        if (container) {
          pending.panning = true
          panRef.current = {
            x: pending.clientX,
            y: pending.clientY,
            sl: container.scrollLeft,
            st: container.scrollTop,
          }
        }
      }
    }

    if (panRef.current && containerRef.current) {
      containerRef.current.scrollLeft =
        panRef.current.sl - (e.clientX - panRef.current.x)
      containerRef.current.scrollTop =
        panRef.current.st - (e.clientY - panRef.current.y)
      return
    }

    if (resizeRef.current) {
      const r = resizeRef.current
      const lockAspect = e.shiftKey
      if (r.kind === 'stroke') {
        resizePointerRef.current = {
          x: canv.x,
          y: canv.y,
          shiftKey: lockAspect,
        }
        const scaled = scaleStrokeFromCorner(
          r.originalStroke,
          r.startBounds,
          canv.x,
          canv.y,
          r.originX,
          r.originY,
          lockAspect,
        )
        useNotesStore.setState((s) => ({
          strokes: s.strokes.map((st) => (st.id === r.id ? scaled : st)),
        }))
        return
      }
      const { width, height } = sizeFromCornerResize(
        r.startW,
        r.startH,
        canv.x,
        canv.y,
        r.originX,
        r.originY,
        lockAspect,
        r.kind === 'box' ? MIN_BOX_WIDTH : MIN_IMAGE_SIZE,
        r.kind === 'box' ? MIN_BOX_HEIGHT : MIN_IMAGE_SIZE,
      )
      if (r.kind === 'box') {
        useNotesStore.setState((s) => ({
          textBoxes: s.textBoxes.map((b) =>
            b.id === r.id ? { ...b, width, height } : b,
          ),
        }))
      } else {
        useNotesStore.setState((s) => ({
          images: s.images.map((img) =>
            img.id === r.id ? { ...img, width, height } : img,
          ),
        }))
      }
      return
    }

    if (boxDragRef.current) {
      const d = boxDragRef.current
      useNotesStore.setState((s) => ({
        textBoxes: s.textBoxes.map((b) =>
          b.id === d.id
            ? {
                ...b,
                x: Math.max(
                  0,
                  Math.min(canvasWidth - b.width, canv.x - d.offsetX),
                ),
                y: Math.max(
                  0,
                  Math.min(canvasHeight - b.height, canv.y - d.offsetY),
                ),
              }
            : b,
        ),
      }))
      return
    }

    if (imageDragRef.current) {
      const d = imageDragRef.current
      useNotesStore.setState((s) => ({
        images: s.images.map((img) =>
          img.id === d.id
            ? {
                ...img,
                x: Math.max(
                  0,
                  Math.min(canvasWidth - img.width, canv.x - d.offsetX),
                ),
                y: Math.max(
                  0,
                  Math.min(canvasHeight - img.height, canv.y - d.offsetY),
                ),
              }
            : img,
        ),
      }))
      return
    }

    if (strokeDragRef.current) {
      const d = strokeDragRef.current
      const dx = canv.x - d.startX
      const dy = canv.y - d.startY
      useNotesStore.setState((s) => ({
        strokes: s.strokes.map((st) =>
          st.id === d.id
            ? translateStroke(
                { ...st, points: d.startPoints },
                dx,
                dy,
              )
            : st,
        ),
      }))
      return
    }

    if (tool === 'edit' && editDragRef.current) {
      const drag = editDragRef.current
      drag.curX = canv.x
      drag.curY = canv.y
      if (
        !drag.marqueeActive &&
        Math.hypot(canv.x - drag.startX, canv.y - drag.startY) > 5
      ) {
        drag.marqueeActive = true
      }
      if (drag.marqueeActive) {
        setMarquee(normalizeRect(drag.startX, drag.startY, canv.x, canv.y))
      }
      return
    }

    if (tool === 'draw' && drawSubTool === 'eraser') {
      runEraserAt(canv)
      return
    }

    if (!drawingRef.current || tool !== 'draw' || drawSubTool !== 'pen') return
    const points = currentStrokeRef.current
    const last = points[points.length - 1]
    if (last && Math.hypot(canv.x - last.x, canv.y - last.y) < 1) return
    points.push(canv)
    setDraftStrokePoints([...points])
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && last) {
      ctx.strokeStyle = settings.drawColor
      ctx.lineWidth = settings.drawSize
      ctx.lineTo(canv.x, canv.y)
      ctx.stroke()
    }
  }

  const commitBoxGeometry = (id: string) => {
    const live = useNotesStore.getState().textBoxes.find((b) => b.id === id)
    if (!live) return
    const cur = snapshot()
    const prev = cur.textBoxes.find((b) => b.id === id)
    if (
      prev &&
      prev.x === live.x &&
      prev.y === live.y &&
      prev.width === live.width &&
      prev.height === live.height
    ) {
      return
    }
    commit({
      ...cur,
      textBoxes: cur.textBoxes.map((b) => (b.id === id ? live : b)),
    })
  }

  const commitImageGeometry = (id: string) => {
    const live = useNotesStore.getState().images.find((i) => i.id === id)
    if (!live) return
    const cur = snapshot()
    const prev = cur.images.find((i) => i.id === id)
    if (
      prev &&
      prev.x === live.x &&
      prev.y === live.y &&
      prev.width === live.width &&
      prev.height === live.height
    ) {
      return
    }
    commit({
      ...cur,
      images: cur.images.map((i) => (i.id === id ? live : i)),
    })
  }

  const commitStrokeGeometry = (id: string) => {
    const live = useNotesStore.getState().strokes.find((s) => s.id === id)
    if (!live) return
    const cur = snapshot()
    const prev = cur.strokes.find((s) => s.id === id)
    if (prev && JSON.stringify(prev.points) === JSON.stringify(live.points)) {
      return
    }
    commit({
      ...cur,
      strokes: cur.strokes.map((s) => (s.id === id ? live : s)),
    })
  }

  const handleSurfacePointerUp = () => {
    if (panPendingRef.current) {
      const pending = panPendingRef.current
      panPendingRef.current = null
      if (!pending.panning) {
        pickAt(pending.canvX, pending.canvY, pending.modifier)
      }
      panRef.current = null
      return
    }
    if (panRef.current) {
      panRef.current = null
      return
    }
    if (resizeRef.current) {
      const r = resizeRef.current
      if (r.kind === 'box') commitBoxGeometry(r.id)
      else if (r.kind === 'image') commitImageGeometry(r.id)
      else commitStrokeGeometry(r.id)
      resizeRef.current = null
      resizePointerRef.current = null
      return
    }
    if (boxDragRef.current) {
      commitBoxGeometry(boxDragRef.current.id)
      boxDragRef.current = null
      return
    }
    if (imageDragRef.current) {
      commitImageGeometry(imageDragRef.current.id)
      imageDragRef.current = null
      return
    }
    if (strokeDragRef.current) {
      commitStrokeGeometry(strokeDragRef.current.id)
      strokeDragRef.current = null
      return
    }

    if (tool === 'edit' && editDragRef.current) {
      const drag = editDragRef.current
      editDragRef.current = null
      setMarquee(null)
      if (drag.marqueeActive) {
        const rect = normalizeRect(
          drag.startX,
          drag.startY,
          drag.curX,
          drag.curY,
        )
        if (rect.w > 4 || rect.h > 4) {
          const { boxIds, strokeIds, imageIds } = selectInRect(
            rect,
            textBoxes,
            strokes,
            images,
          )
          if (drag.shiftKey) {
            const nb = new Set(selectedBoxIds)
            const ns = new Set(selectedStrokeIds)
            const ni = new Set(selectedImageIds)
            boxIds.forEach((id) => nb.add(id))
            strokeIds.forEach((id) => ns.add(id))
            imageIds.forEach((id) => ni.add(id))
            setSelectedBoxIds(nb)
            setSelectedStrokeIds(ns)
            setSelectedImageIds(ni)
          } else {
            setSelection(boxIds, strokeIds, imageIds)
          }
        }
      } else {
        pickAt(drag.startX, drag.startY, drag.shiftKey ? 'shift' : 'none')
      }
      return
    }

    if (tool === 'draw' && drawSubTool === 'eraser') finishEraser()
    else if (tool === 'draw') finishPenStroke()
  }

  const patchTextLive = (id: string, content: string) => {
    useNotesStore.setState((s) => ({
      textBoxes: s.textBoxes.map((b) =>
        b.id === id ? { ...b, content } : b,
      ),
    }))
  }

  const commitText = (id: string, content: string) => {
    const cur = snapshot()
    const prev = cur.textBoxes.find((b) => b.id === id)
    if (prev?.content === content) return
    commit({
      ...cur,
      textBoxes: cur.textBoxes.map((b) =>
        b.id === id ? { ...b, content } : b,
      ),
    })
  }

  const sortedBoxes = sortByZIndex(textBoxes)
  const sortedImages = sortByZIndex(images)

  const canEditContent = tool === 'edit'
  const canManipulate = tool === 'edit'
  const objectPointerEvents = tool !== 'draw'

  const resizeHandle = (
    onDown: (e: ReactPointerEvent<HTMLDivElement>) => void,
  ) => (
    <div
      data-resize-handle
      className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize bg-selection/80"
      onPointerDown={onDown}
    />
  )

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-auto bg-surface-elevated outline-none',
          tool === 'pan' && 'cursor-grab active:cursor-grabbing',
          tool === 'edit' && 'cursor-default',
          tool === 'insert' && 'cursor-crosshair',
          tool === 'draw' &&
            (drawSubTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'),
          tool === 'color' && 'cursor-default',
        )}
        style={{ maxHeight: '70vh' }}
        onWheel={handleWheel}
      >
      <div
        style={{
          width: canvasWidth * zoom,
          height: canvasHeight * zoom,
        }}
      >
        <div
          ref={surfaceRef}
          tabIndex={0}
          role="application"
          aria-label="Notes canvas"
          className="relative origin-top-left outline-none"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
          }}
          onKeyDown={handleKeyDown}
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={handleSurfacePointerMove}
          onPointerUp={handleSurfacePointerUp}
          onPointerLeave={handleSurfacePointerUp}
          onPointerCancel={handleSurfacePointerUp}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="pointer-events-none absolute inset-0 touch-none"
          />

          {marquee && tool === 'edit' && (
            <div
              className="pointer-events-none absolute border border-dashed border-selection/80 bg-selection/10"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.w,
                height: marquee.h,
              }}
            />
          )}

          {sortedImages.map((img) => {
            const selected = selectedImageIds.has(img.id)
            const highlighted = img.highlighted
            return (
              <div
                key={img.id}
                data-note-image
                className={cn(
                  'absolute overflow-hidden rounded-sm',
                  selected && 'ring-2 ring-selection',
                )}
                style={{
                  left: img.x,
                  top: img.y,
                  width: img.width,
                  height: img.height,
                  pointerEvents: objectPointerEvents ? 'auto' : 'none',
                  ...(highlighted
                    ? { boxShadow: `0 0 0 2px ${settings.highlightColor}` }
                    : {}),
                }}
                onPointerDown={(e) => {
                  if (!objectPointerEvents || canManipulate) return
                  if ((e.target as HTMLElement).closest('[data-resize-handle]'))
                    return
                  if ((e.target as HTMLElement).closest('[data-top-bar]')) return
                  e.stopPropagation()
                  const canv = pointerToCanvas(e.clientX, e.clientY)
                  pickImageAt(canv.x, canv.y, pickModifierFromEvent(e))
                }}
              >
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-fill pointer-events-none"
                />
                {canManipulate && selected && (
                  <>
                    <div
                      data-top-bar
                      className="absolute inset-x-0 top-0 h-6 cursor-move bg-selection-muted"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        const canv = pointerToCanvas(e.clientX, e.clientY)
                        const modifier = pickModifierFromEvent(e)
                        pickImageAt(canv.x, canv.y, modifier)
                        if (modifier !== 'none') return
                        imageDragRef.current = {
                          id: img.id,
                          offsetX: canv.x - img.x,
                          offsetY: canv.y - img.y,
                        }
                        ;(e.currentTarget as HTMLElement).setPointerCapture(
                          e.pointerId,
                        )
                      }}
                    />
                    {resizeHandle((e) => {
                      e.stopPropagation()
                      const canv = pointerToCanvas(e.clientX, e.clientY)
                      resizeRef.current = {
                        kind: 'image',
                        id: img.id,
                        startW: img.width,
                        startH: img.height,
                        originX: canv.x,
                        originY: canv.y,
                      }
                      ;(e.currentTarget as HTMLElement).setPointerCapture(
                        e.pointerId,
                      )
                    })}
                  </>
                )}
              </div>
            )
          })}

          {sortedBoxes.map((box) => {
            const selected = selectedBoxIds.has(box.id)
            const highlighted = box.highlighted
            const bg = box.backgroundColor ?? settings.textBackgroundColor

            return (
              <div
                key={box.id}
                data-note-box
                className={cn(
                  'absolute flex flex-col overflow-hidden rounded-md shadow-sm',
                  highlighted && 'ring-2',
                  selected && 'ring-2 ring-selection',
                )}
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  backgroundColor: bg,
                  pointerEvents: objectPointerEvents ? 'auto' : 'none',
                  ...(highlighted
                    ? { boxShadow: `0 0 0 2px ${settings.highlightColor}` }
                    : {}),
                }}
              >
                <div
                  data-top-bar
                  className={cn(
                    'flex h-7 shrink-0 cursor-pointer items-center border-b border-border/80 px-2 text-xs text-muted-foreground select-none',
                    selected ? 'bg-selection-muted' : 'bg-surface-elevated/60',
                  )}
                  onPointerDown={(e) => {
                    if (!objectPointerEvents) return
                    e.stopPropagation()
                    const canv = pointerToCanvas(e.clientX, e.clientY)
                    const modifier = pickModifierFromEvent(e)
                    pickBoxAt(canv.x, canv.y, modifier)
                    if (!canManipulate || modifier !== 'none') return
                    boxDragRef.current = {
                      id: box.id,
                      offsetX: canv.x - box.x,
                      offsetY: canv.y - box.y,
                    }
                    ;(e.currentTarget as HTMLElement).setPointerCapture(
                      e.pointerId,
                    )
                  }}
                >
                  <span className="truncate">Note</span>
                </div>

                <textarea
                  value={box.content}
                  readOnly={!canEditContent}
                  tabIndex={canEditContent ? 0 : -1}
                  onPointerDown={(e) => e.stopPropagation()}
                  onFocus={() => {
                    setFocusedBoxId(box.id)
                    clearSelection()
                  }}
                  onBlur={(e) => {
                    setFocusedBoxId((id) => (id === box.id ? null : id))
                    if (canEditContent) commitText(box.id, e.target.value)
                  }}
                  onChange={(e) => {
                    if (canEditContent) patchTextLive(box.id, e.target.value)
                  }}
                  placeholder="Write a note…"
                  style={boxTextStyle(box, settings)}
                  className={cn(
                    'min-h-0 flex-1 resize-none bg-transparent px-2 py-1.5 focus:outline-none',
                    'placeholder:text-[color:var(--note-placeholder)]',
                    !canEditContent && 'pointer-events-none',
                  )}
                />

                {canManipulate && selected && (
                  <>
                    {resizeHandle((e) => {
                      e.stopPropagation()
                      const canv = pointerToCanvas(e.clientX, e.clientY)
                      resizeRef.current = {
                        kind: 'box',
                        id: box.id,
                        startW: box.width,
                        startH: box.height,
                        originX: canv.x,
                        originY: canv.y,
                      }
                      ;(e.currentTarget as HTMLElement).setPointerCapture(
                        e.pointerId,
                      )
                    })}
                  </>
                )}
              </div>
            )
          })}

          {canManipulate &&
            [...selectedStrokeIds].map((id) => {
              const s = strokes.find((st) => st.id === id)
              if (!s) return null
              const resize = resizeRef.current
              const ptr = resizePointerRef.current
              const bounds =
                resize?.kind === 'stroke' &&
                resize.id === id &&
                ptr
                  ? (() => {
                      const { width, height } = sizeFromCornerResize(
                        resize.startBounds.w,
                        resize.startBounds.h,
                        ptr.x,
                        ptr.y,
                        resize.originX,
                        resize.originY,
                        ptr.shiftKey,
                        8,
                        8,
                      )
                      return {
                        x: resize.startBounds.x,
                        y: resize.startBounds.y,
                        w: width,
                        h: height,
                      }
                    })()
                  : strokeBounds(s)
              if (!bounds) return null
              return (
                <div
                  key={`stroke-resize-${id}`}
                  data-stroke-overlay
                  className="pointer-events-auto absolute border border-dashed border-selection"
                  style={{
                    left: bounds.x,
                    top: bounds.y,
                    width: bounds.w,
                    height: bounds.h,
                  }}
                >
                  <div
                    data-stroke-drag
                    className="absolute inset-x-0 top-0 h-6 cursor-move bg-selection-muted"
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest('[data-resize-handle]'))
                        return
                      e.stopPropagation()
                      const canv = pointerToCanvas(e.clientX, e.clientY)
                      const live = useNotesStore.getState().strokes.find((st) => st.id === id)
                      if (!live) return
                      strokeDragRef.current = {
                        id,
                        startPoints: live.points.map((p) => ({ ...p })),
                        startX: canv.x,
                        startY: canv.y,
                      }
                      ;(e.currentTarget as HTMLElement).setPointerCapture(
                        e.pointerId,
                      )
                    }}
                  />
                  <div
                    data-resize-handle
                    className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize bg-selection/80"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const canv = pointerToCanvas(e.clientX, e.clientY)
                      resizePointerRef.current = {
                        x: canv.x,
                        y: canv.y,
                        shiftKey: e.shiftKey,
                      }
                      resizeRef.current = {
                        kind: 'stroke',
                        id,
                        startBounds: bounds,
                        originX: canv.x,
                        originY: canv.y,
                        originalStroke: cloneStroke(s),
                      }
                      ;(e.currentTarget as HTMLElement).setPointerCapture(
                        e.pointerId,
                      )
                    }}
                  />
                </div>
              )
            })}
        </div>
      </div>
      </div>
    </div>
  )
})

NotesCanvas.displayName = 'NotesCanvas'
