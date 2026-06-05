import { Bold, Italic, Underline } from 'lucide-react'
import type { NotesEditorSettings } from '@/lib/notes-types'
import { parseDecimalInput } from '@/lib/decimal-input'
import { cn } from '@/lib/utils'
import { ColorField, numberInputClass } from './notes-panel-fields'

export function NotesTextFormatBar({
  active,
  settings,
  onSettingsChange,
  onToggleKey,
  onFontSize,
}: {
  active: boolean
  settings: NotesEditorSettings
  onSettingsChange: (patch: Partial<NotesEditorSettings>) => void
  onToggleKey: (key: 'bold' | 'italic' | 'underline') => void
  onFontSize: (size: number) => void
}) {
  const btn = (
    label: string,
    icon: React.ReactNode,
    key: 'bold' | 'italic' | 'underline',
  ) => (
    <button
      type="button"
      title={label}
      disabled={!active}
      onClick={() => onToggleKey(key)}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground',
        active && 'hover:bg-muted hover:text-foreground',
        !active && 'opacity-40',
      )}
    >
      {icon}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2">
      <span className="text-xs text-muted-foreground">Format</span>
      {btn('Bold (⌘B)', <Bold className="h-4 w-4" />, 'bold')}
      {btn('Italic (⌘I)', <Italic className="h-4 w-4" />, 'italic')}
      {btn('Underline (⌘U)', <Underline className="h-4 w-4" />, 'underline')}
      <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span>Size</span>
        <input
          type="text"
          inputMode="numeric"
          min={10}
          max={48}
          defaultValue={14}
          disabled={!active}
          className={`h-7 w-12 rounded-md border border-border bg-surface px-2 ${numberInputClass}`}
          onChange={(e) => {
            const v = parseDecimalInput(e.target.value)
            if (v !== null) onFontSize(v)
          }}
        />
      </label>

      <ColorField
        label="Box fill"
        value={settings.textBackgroundColor}
        onChange={(textBackgroundColor) => onSettingsChange({ textBackgroundColor })}
      />
      <ColorField
        label="Text"
        value={settings.textColor}
        onChange={(textColor) => onSettingsChange({ textColor })}
      />

      <p className="w-full text-xs text-muted-foreground">
        ⌘B · ⌘I · ⌘U — applies to focused or selected boxes
      </p>
    </div>
  )
}
