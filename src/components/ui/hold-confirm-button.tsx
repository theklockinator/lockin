import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const DEFAULT_HOLD_MS = 400

export function HoldConfirmButton({
  onConfirm,
  holdMs = DEFAULT_HOLD_MS,
  children,
  className,
  title = 'Hold to confirm',
  ariaLabel,
}: {
  onConfirm: () => void
  holdMs?: number
  children: ReactNode
  className?: string
  title?: string
  ariaLabel?: string
}) {
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

  const cancel = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setProgress(0)
  }

  const start = () => {
    cancel()
    startTimeRef.current = Date.now()
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const next = Math.min(1, elapsed / holdMs)
      setProgress(next)
      if (next >= 1) {
        cancel()
        onConfirm()
      }
    }, 16)
  }

  useEffect(() => cancel, [])

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      onPointerDown={(e) => {
        e.preventDefault()
        start()
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className={cn(
        'relative overflow-hidden rounded-md border border-border bg-secondary text-secondary-foreground',
        'inline-flex items-center justify-center transition-colors hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 bg-ring transition-none"
        style={{ width: `${progress * 100}%` }}
        aria-hidden="true"
      />
      <span className="relative">{children}</span>
    </button>
  )
}
