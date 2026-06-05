import {
  Download,
  Eraser,
  Hand,
  MousePointer2,
  Palette,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { NotesColorPanel } from '@/components/notes/NotesColorPanel'
import { NotesInsertPanel } from '@/components/notes/NotesInsertPanel'
import { NotesTextFormatBar } from '@/components/notes/NotesTextFormatBar'
import {
  downloadNotesJson,
  parseNotesImport,
  replaceNotesImport,
} from '@/lib/notes-storage'
import {
  DEFAULT_EDITOR_SETTINGS,
  type DrawSubTool,
  type NotesEditorSettings,
  type NotesTool,
} from '@/lib/notes-types'
import { useNotesStore } from '@/store/useNotesStore'
import { NotesCanvas, type NotesCanvasHandle } from './NotesCanvas'
import { cn } from '@/lib/utils'

const TOOLS: { id: NotesTool; label: string; icon: typeof Hand }[] = [
  { id: 'pan', label: 'Pan', icon: Hand },
  { id: 'edit', label: 'Edit', icon: MousePointer2 },
  { id: 'insert', label: 'Insert', icon: Plus },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'color', label: 'Color', icon: Palette },
]

const HINTS: Record<NotesTool, string> = {
  pan: 'Drag to pan. Click selects; ⇧-click toggles in selection. ⌘ scroll or ⌘+/− to zoom.',
  edit:
    'Select/move/resize text & colors below. Click replaces selection; ⇧-click toggles. ⌘A · ⌘C/X/V · Del · ⇧H · ⌘↑↓ · ⌘Z',
  insert:
    'Click empty canvas for a text box. Click selects; ⇧-click toggles. Paste images with ⌘V.',
  draw: 'Pen or eraser. Draw color and size on pen; eraser diameter on eraser. ⌘Z undo.',
  color:
    'Highlight and draw colors. Click selects; ⇧-click toggles. Apply color to selected.',
}

export function NotesTab() {
  const replaceNotes = useNotesStore((s) => s.replaceNotes)
  const [tool, setTool] = useState<NotesTool>('edit')
  const [drawSubTool, setDrawSubTool] = useState<DrawSubTool>('pen')
  const [settings, setSettings] =
    useState<NotesEditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [zoom, setZoom] = useState(1)
  const [hasSelection, setHasSelection] = useState(false)
  const [hasTextTargets, setHasTextTargets] = useState(false)
  const canvasRef = useRef<NotesCanvasHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<ReturnType<
    typeof parseNotesImport
  > | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleExport = () => {
    const { textBoxes, strokes, images } = useNotesStore.getState()
    downloadNotesJson({
      textBoxes,
      strokes,
      images: images ?? [],
    })
  }

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      setPendingImport(parseNotesImport(raw))
      setImportError(null)
    } catch {
      setImportError('Invalid notes file. Check the JSON format.')
    }
  }

  const handleImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      const img = new Image()
      img.onload = () => {
        canvasRef.current?.insertImage(
          src,
          img.naturalWidth,
          img.naturalHeight,
        )
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs',
                tool === id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tool === 'draw' && (
          <div className="flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setDrawSubTool('pen')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs',
                drawSubTool === 'pen'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              Pen
            </button>
            <button
              type="button"
              onClick={() => setDrawSubTool('eraser')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs',
                drawSubTool === 'eraser'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Eraser className="h-3.5 w-3.5" />
              Eraser
            </button>
          </div>
        )}

        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {tool === 'insert' && (
        <NotesInsertPanel onInsertImage={() => imageRef.current?.click()} />
      )}

      {tool === 'edit' && (
        <NotesTextFormatBar
          active={hasTextTargets}
          settings={settings}
          onSettingsChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onToggleKey={(key) => canvasRef.current?.toggleFormatKey(key)}
          onFontSize={(size) => canvasRef.current?.setFontSize(size)}
        />
      )}

      {tool === 'color' && (
        <NotesColorPanel
          mode="color"
          settings={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onApplyToSelected={() => canvasRef.current?.applyColorsToSelected()}
          hasSelection={hasSelection}
        />
      )}

      {tool === 'draw' && drawSubTool === 'pen' && (
        <NotesColorPanel
          mode="draw-pen"
          settings={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onApplyToSelected={() => canvasRef.current?.applyColorsToSelected()}
          hasSelection={hasSelection}
        />
      )}

      {tool === 'draw' && drawSubTool === 'eraser' && (
        <NotesColorPanel
          mode="draw-eraser"
          settings={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onApplyToSelected={() => canvasRef.current?.applyColorsToSelected()}
          hasSelection={hasSelection}
        />
      )}

      <p className="text-xs text-muted-foreground">{HINTS[tool]}</p>
      {importError && <p className="text-xs text-red-400">{importError}</p>}

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageFile(file)
          e.target.value = ''
        }}
      />

      <NotesCanvas
        ref={canvasRef}
        tool={tool}
        drawSubTool={drawSubTool}
        settings={settings}
        zoom={zoom}
        onZoomChange={setZoom}
        onSelectionChange={setHasSelection}
        onTextTargetsChange={setHasTextTargets}
      />

      <Dialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Import notes"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Replace all notes on the canvas with this file?
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (pendingImport) {
                replaceNotes(replaceNotesImport(pendingImport))
                setPendingImport(null)
              }
            }}
          >
            Replace
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
