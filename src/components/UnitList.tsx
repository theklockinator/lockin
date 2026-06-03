import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useLockinStore } from '@/store/useLockinStore'
import { UnitCard } from './UnitCard'

export function UnitList() {
  const units = useLockinStore((s) => s.units)
  const deleteAllUnits = useLockinStore((s) => s.deleteAllUnits)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const sorted = [...units].sort((a, b) => a.sortOrder - b.sortOrder)

  if (sorted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Add a unit to start.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-red-500 underline-offset-2 hover:bg-transparent hover:text-red-400 hover:underline"
          onClick={() => setConfirmDeleteAll(true)}
        >
          Delete all units
        </Button>
      </div>
      {sorted.map((unit, index) => (
        <UnitCard
          key={unit.id}
          unit={unit}
          isFirst={index === 0}
          isLast={index === sorted.length - 1}
        />
      ))}

      <Dialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title="Delete all units?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          This removes all {sorted.length} unit
          {sorted.length === 1 ? '' : 's'} and their practice papers. This
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmDeleteAll(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              deleteAllUnits()
              setConfirmDeleteAll(false)
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
