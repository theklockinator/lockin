import * as React from 'react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg',
        )}
      >
        <h2 id="dialog-title" className="mb-4 text-lg font-medium">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
