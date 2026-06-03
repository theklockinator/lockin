import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { THEMES, applyTheme, getStoredTheme, type ThemeId } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { resetAllAppData } from '@/lib/reset-app'

const RESET_CONFIRM = 'reset'

export function ThemeFooter() {
  const [active, setActive] = useState<ThemeId>(getStoredTheme)
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const closeReset = () => {
    setResetOpen(false)
    setConfirmText('')
  }

  const handleReset = () => {
    if (confirmText !== RESET_CONFIRM) return
    resetAllAppData()
    closeReset()
  }

  return (
    <footer className="border-t border-border px-4 py-4">
      <nav
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-1 gap-y-1 text-xs text-muted-foreground"
        aria-label="Footer"
      >
        {THEMES.map((theme, index) => (
          <span key={theme.id} className="inline-flex items-center">
            {index > 0 && <span className="mx-1.5 select-none">·</span>}
            <button
              type="button"
              onClick={() => {
                applyTheme(theme.id)
                setActive(theme.id)
              }}
              className={cn(
                'underline-offset-2 hover:text-foreground hover:underline',
                active === theme.id
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {theme.label}
            </button>
          </span>
        ))}
        <span className="mx-1.5 select-none" aria-hidden="true">
          |
        </span>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="text-red-500 underline-offset-2 hover:text-red-400 hover:underline"
        >
          reset
        </button>
      </nav>

      <Dialog open={resetOpen} onClose={closeReset} title="reset all data">
        <p className="mb-4 text-sm text-muted-foreground">
          This permanently deletes all track, notes, and exam data, including
          units, practice papers, streak, canvas, and your exam schedule.
          Type <span className="font-medium text-foreground">{RESET_CONFIRM}</span>{' '}
          below to confirm.
        </p>
        <label className="mb-4 block space-y-1.5 text-sm">
          <span className="text-muted-foreground">confirmation</span>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={RESET_CONFIRM}
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && confirmText === RESET_CONFIRM) {
                handleReset()
              }
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeReset}>
            cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={confirmText !== RESET_CONFIRM}
            onClick={handleReset}
          >
            reset all
          </Button>
        </div>
      </Dialog>
    </footer>
  )
}
