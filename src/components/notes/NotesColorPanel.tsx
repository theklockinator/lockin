import { Button } from '@/components/ui/button'
import type { EraserMode, NotesEditorSettings } from '@/lib/notes-types'
import { ColorField, SizeField } from './notes-panel-fields'

export type NotesColorPanelMode = 'color' | 'draw-pen' | 'draw-eraser'

export function NotesColorPanel({
  mode,
  settings,
  onChange,
  onApplyToSelected,
  hasSelection,
}: {
  mode: NotesColorPanelMode
  settings: NotesEditorSettings
  onChange: (patch: Partial<NotesEditorSettings>) => void
  onApplyToSelected: () => void
  hasSelection: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2">
      {(mode === 'color' || mode === 'draw-pen') && (
        <ColorField
          label="Draw"
          value={settings.drawColor}
          onChange={(drawColor) => onChange({ drawColor })}
        />
      )}

      {mode === 'color' && (
        <>
          <ColorField
            label="Highlight"
            value={settings.highlightColor}
            onChange={(highlightColor) => onChange({ highlightColor })}
          />
          <SizeField
            label="Highlight width"
            min={2}
            max={24}
            value={settings.highlightWidth}
            onChange={(highlightWidth) => onChange({ highlightWidth })}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!hasSelection}
            onClick={onApplyToSelected}
          >
            Apply color to selected
          </Button>
        </>
      )}

      {mode === 'draw-pen' && (
        <SizeField
          label="Draw size"
          min={1}
          max={24}
          value={settings.drawSize}
          onChange={(drawSize) => onChange({ drawSize })}
        />
      )}

      {mode === 'draw-eraser' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Eraser</span>
          <div className="flex rounded-md border border-border p-0.5">
            {(['stroke', 'pixel'] as EraserMode[]).map((eraserMode) => (
              <button
                key={eraserMode}
                type="button"
                onClick={() => onChange({ eraserMode })}
                className={
                  settings.eraserMode === eraserMode
                    ? 'rounded bg-muted px-2 py-1 text-xs text-foreground'
                    : 'rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground'
                }
              >
                {eraserMode === 'stroke' ? 'Stroke' : 'Pixel'}
              </button>
            ))}
          </div>
          <SizeField
            label="Diameter"
            min={4}
            max={64}
            value={settings.eraserDiameter}
            onChange={(eraserDiameter) => onChange({ eraserDiameter })}
            inputWidth="w-16 min-w-16"
          />
        </div>
      )}
    </div>
  )
}
