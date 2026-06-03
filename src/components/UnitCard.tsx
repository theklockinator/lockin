import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PracticeGrid } from '@/components/PracticeGrid'
import {
  papersOnDate,
  quotaMet,
  rollingAvgMarks,
  rollingAvgTime,
  scorePercent,
  timeDelta,
  todayStr,
} from '@/lib/stats'
import type { Unit } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useLockinStore } from '@/store/useLockinStore'

type UnitCardProps = {
  unit: Unit
  isFirst: boolean
  isLast: boolean
}

export function UnitCard({ unit, isFirst, isLast }: UnitCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateUnit = useLockinStore((s) => s.updateUnit)
  const deleteUnit = useLockinStore((s) => s.deleteUnit)
  const moveUnit = useLockinStore((s) => s.moveUnit)

  const [name, setName] = useState(unit.name)
  const [duration, setDuration] = useState(String(unit.examDurationMinutes))
  const [maxMarks, setMaxMarks] = useState(String(unit.maxMarks))
  const [quota, setQuota] = useState(String(unit.dailyQuota))

  const today = todayStr()
  const count = papersOnDate(unit, today)
  const met = quotaMet(unit, today)
  const marks = rollingAvgMarks(unit)
  const time = rollingAvgTime(unit)
  const delta = timeDelta(time, unit.examDurationMinutes)

  const saveEdit = () => {
    const examDurationMinutes = Number(duration)
    const max = Number(maxMarks)
    const dailyQuota = Number(quota)
    if (
      !name.trim() ||
      examDurationMinutes <= 0 ||
      max <= 0 ||
      dailyQuota <= 0
    ) {
      return
    }
    updateUnit(unit.id, {
      name: name.trim(),
      examDurationMinutes,
      maxMarks: max,
      dailyQuota,
      rollingN: unit.rollingN,
    })
    setEditing(false)
  }

  return (
    <article className="rounded-lg border border-border bg-surface/50">
      <div className="flex items-start gap-2 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-foreground">{unit.name}</h3>
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs tabular-nums',
                  met
                    ? 'bg-success/20 text-success-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                today {count}/{unit.dailyQuota}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Avg (n={unit.rollingN}){' '}
              {marks !== null
                ? `${marks}/${unit.maxMarks} (${scorePercent(marks, unit.maxMarks)}%)`
                : '—'}{' '}
              · time{' '}
              {time !== null ? `${time} min` : '—'}
              {delta !== null && (
                <span
                  className={cn(
                    delta <= 0 ? 'text-success-foreground' : 'text-muted-foreground',
                  )}
                >
                  {' '}
                  ({delta > 0 ? '+' : ''}
                  {delta} vs {unit.examDurationMinutes}m)
                </span>
              )}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isFirst}
            onClick={() => moveUnit(unit.id, 'up')}
            aria-label="Move unit up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isLast}
            onClick={() => moveUnit(unit.id, 'down')}
            aria-label="Move unit down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEditing((v) => !v)}
            aria-label="Edit unit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete unit"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-border px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name" htmlFor={`edit-name-${unit.id}`}>
              <Input
                id={`edit-name-${unit.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Duration (min)" htmlFor={`edit-duration-${unit.id}`}>
              <Input
                id={`edit-duration-${unit.id}`}
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
            <Field label="Max marks" htmlFor={`edit-marks-${unit.id}`}>
              <Input
                id={`edit-marks-${unit.id}`}
                type="number"
                min={1}
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
              />
            </Field>
            <Field label="Daily quota" htmlFor={`edit-quota-${unit.id}`}>
              <Input
                id={`edit-quota-${unit.id}`}
                type="number"
                min={1}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={saveEdit}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <PracticeGrid unit={unit} />
        </div>
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete unit?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          This removes {unit.name} and all practice papers. This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              deleteUnit(unit.id)
              setConfirmDelete(false)
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </article>
  )
}
