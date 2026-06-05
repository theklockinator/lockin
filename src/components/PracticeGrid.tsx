import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { HoldConfirmButton } from '@/components/ui/hold-confirm-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DecimalField } from '@/components/ui/decimal-input'
import { Input } from '@/components/ui/input'
import {
  currentDatetimeLocal,
  formatPaperDateTime,
  toDatetimeLocalValue,
} from '@/lib/paper-datetime'
import { parseDecimalInput, formatDecimalInput } from '@/lib/decimal-input'
import {
  papersOnDate,
  rollingAvgMarks,
  rollingAvgTime,
  rollingSampleCount,
  scorePercent,
  sortedPapers,
  timeDelta,
  todayStr,
} from '@/lib/stats'
import { numberInputNoSpin } from '@/lib/form-classes'
import { MAX_ROLLING_N, MIN_ROLLING_N } from '@/lib/types'
import type { Unit } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useLockinStore } from '@/store/useLockinStore'

type UnitProps = {
  unit: Unit
}

type Draft = {
  name: string
  completedAt: string
  timeMinutes: string
  marks: string
}

function emptyDraft(): Draft {
  return {
    name: '',
    completedAt: currentDatetimeLocal(),
    timeMinutes: '',
    marks: '',
  }
}

export function PracticeGrid({ unit }: UnitProps) {
  const addPaper = useLockinStore((s) => s.addPaper)
  const updatePaper = useLockinStore((s) => s.updatePaper)
  const deletePaper = useLockinStore((s) => s.deletePaper)
  const deleteAllPapers = useLockinStore((s) => s.deleteAllPapers)
  const updateUnitRollingN = useLockinStore((s) => s.updateUnitRollingN)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const papers = sortedPapers(unit)
  const today = todayStr()
  const count = papersOnDate(unit, today)
  const marks = rollingAvgMarks(unit)
  const time = rollingAvgTime(unit)
  const delta = timeDelta(time, unit.examDurationMinutes)
  const sampleN = rollingSampleCount(unit)
  const targetN = unit.rollingN

  const submitDraft = () => {
    const timeMinutes = parseDecimalInput(draft.timeMinutes)
    const marksVal = parseDecimalInput(draft.marks)

    if (
      !draft.completedAt ||
      timeMinutes === null ||
      timeMinutes < 0 ||
      marksVal === null ||
      marksVal < 0
    ) {
      setError('Enter valid date & time, duration, and marks.')
      return
    }
    if (marksVal > unit.maxMarks) {
      setError(`Marks cannot exceed ${unit.maxMarks}.`)
      return
    }

    const ok = addPaper(unit.id, {
      name: draft.name.trim(),
      completedAt: draft.completedAt,
      timeMinutes,
      marks: marksVal,
    })

    if (ok) {
      setDraft(emptyDraft())
      setError(null)
    } else {
      setError('Could not add paper.')
    }
  }

  const handleDraftKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitDraft()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4 tabular-nums">
        <div>
          Avg marks (n={targetN}):{' '}
          <span className="text-foreground">
            {marks !== null
              ? `${marks} (${scorePercent(marks, unit.maxMarks)}%)`
              : '—'}
          </span>
          {sampleN > 0 && sampleN < targetN && (
            <span className="text-muted-foreground"> · {sampleN} paper(s)</span>
          )}
        </div>
        <div>
          Avg time (n={targetN}):{' '}
          <span className="text-foreground">
            {time !== null ? `${time} min` : '—'}
          </span>
          {delta !== null && (
            <span
              className={cn(
                delta <= 0 ? 'text-success-foreground' : 'text-muted-foreground',
              )}
            >
              {' '}
              ({delta > 0 ? '+' : ''}
              {delta} vs target)
            </span>
          )}
        </div>
        <div>
          Today:{' '}
          <span className="text-foreground">
            {count}/{unit.dailyQuota} papers
          </span>
        </div>
        <div>
          Total:{' '}
          <span className="text-foreground">{unit.practicePapers.length}</span>
        </div>
      </div>

      <label className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-elevated/50 px-3 py-2.5">
        <span className="text-xs font-medium text-foreground">
          Average last
        </span>
        <input
          type="range"
          min={MIN_ROLLING_N}
          max={MAX_ROLLING_N}
          value={unit.rollingN}
          onChange={(e) =>
            updateUnitRollingN(unit.id, Number(e.target.value))
          }
          className="h-2 min-w-[140px] flex-1 cursor-pointer accent-foreground"
          aria-valuetext={`${unit.rollingN} papers`}
        />
        <span className="min-w-[4.5rem] text-right text-sm tabular-nums text-foreground">
          n = {unit.rollingN}
        </span>
        <span className="w-full text-xs text-muted-foreground sm:w-auto">
          papers for rolling average
        </span>
      </label>

      <section
        className="rounded-md border border-panel-tint-border bg-panel-tint px-3 py-3"
        aria-label="Add practice paper"
      >
        <h4 className="mb-2 text-xs font-medium text-panel-tint-text">
          Add practice paper
        </h4>
        <div className="grid gap-2 sm:grid-cols-[minmax(7rem,1fr)_minmax(11rem,1.2fr)_6rem_6rem_auto] sm:items-end">
          <label className="space-y-1 text-xs text-muted-foreground">
            Paper name
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              onKeyDown={handleDraftKeyDown}
              className="h-8"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Date & time
            <Input
              type="datetime-local"
              value={draft.completedAt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, completedAt: e.target.value }))
              }
              onKeyDown={handleDraftKeyDown}
              className="h-8"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Time (min)
            <InputWithMax max={unit.examDurationMinutes}>
              <DecimalField
                value={draft.timeMinutes}
                onChange={(timeMinutes) =>
                  setDraft((d) => ({ ...d, timeMinutes }))
                }
                onKeyDown={handleDraftKeyDown}
                className="h-8"
              />
            </InputWithMax>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Marks
            <InputWithMax max={unit.maxMarks}>
              <DecimalField
                value={draft.marks}
                onChange={(marks) => setDraft((d) => ({ ...d, marks }))}
                onKeyDown={handleDraftKeyDown}
                className="h-8"
              />
            </InputWithMax>
          </label>
          <Button type="button" size="sm" onClick={submitDraft} className="h-8">
            Add paper
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </section>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Practice history
          </h4>
          {papers.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-500 underline-offset-2 hover:bg-transparent hover:text-red-400 hover:underline"
              onClick={() => setConfirmDeleteAll(true)}
            >
              Delete all papers
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/80 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Paper name</th>
                <th className="px-3 py-2 font-medium">Date & time</th>
                <th className="px-3 py-2 font-medium">Time (min)</th>
                <th className="px-3 py-2 font-medium">Marks</th>
                <th className="px-3 py-2 font-medium">Score %</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {papers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-xs text-muted-foreground"
                  >
                    No papers yet — add one above.
                  </td>
                </tr>
              ) : (
                papers.map((paper) => (
                  <PaperRow
                    key={paper.id}
                    unit={unit}
                    paper={paper}
                    onUpdate={updatePaper}
                    onDelete={deletePaper}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title="Delete all papers?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          This removes all {papers.length} practice paper
          {papers.length === 1 ? '' : 's'} for {unit.name}. This cannot be
          undone.
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
              deleteAllPapers(unit.id)
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

function PaperRow({
  unit,
  paper,
  onUpdate,
  onDelete,
}: {
  unit: Unit
  paper: Unit['practicePapers'][number]
  onUpdate: (
    unitId: string,
    paperId: string,
    patch: Partial<{
      name: string
      completedAt: string
      timeMinutes: number
      marks: number
    }>,
  ) => boolean
  onDelete: (unitId: string, paperId: string) => void
}) {
  return (
    <tr className="border-b border-border/60 hover:bg-surface-elevated/30">
      <td className="px-2 py-1.5">
        <Input
          defaultValue={paper.name}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v !== paper.name) {
              onUpdate(unit.id, paper.id, { name: v })
            }
          }}
          className="h-8 min-w-[7rem]"
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(paper.completedAt)}
          title={formatPaperDateTime(paper.completedAt)}
          onBlur={(e) => {
            if (
              e.target.value &&
              e.target.value !== toDatetimeLocalValue(paper.completedAt)
            ) {
              onUpdate(unit.id, paper.id, { completedAt: e.target.value })
            }
          }}
          className="h-8 min-w-[11rem]"
        />
      </td>
      <td className="px-2 py-1.5">
        <InputWithMax max={unit.examDurationMinutes}>
          <Input
            type="text"
            inputMode="decimal"
            defaultValue={formatDecimalInput(paper.timeMinutes)}
            onBlur={(e) => {
              const val = parseDecimalInput(e.target.value)
              if (val !== null && val !== paper.timeMinutes) {
                onUpdate(unit.id, paper.id, { timeMinutes: val })
              }
            }}
            className={cn('h-8', numberInputNoSpin, 'tabular-nums')}
          />
        </InputWithMax>
      </td>
      <td className="px-2 py-1.5">
        <InputWithMax max={unit.maxMarks}>
          <Input
            type="text"
            inputMode="decimal"
            defaultValue={formatDecimalInput(paper.marks)}
            onBlur={(e) => {
              const val = parseDecimalInput(e.target.value)
              if (val !== null && val !== paper.marks) {
                onUpdate(unit.id, paper.id, { marks: val })
              }
            }}
            className={cn('h-8', numberInputNoSpin, 'tabular-nums')}
          />
        </InputWithMax>
      </td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">
        {scorePercent(paper.marks, unit.maxMarks)}%
      </td>
      <td className="px-2 py-1.5">
        <HoldConfirmButton
          onConfirm={() => onDelete(unit.id, paper.id)}
          className="h-8 w-8 border-0 bg-transparent hover:bg-muted"
          title="Hold to delete paper"
          ariaLabel="Hold to delete paper"
        >
          <Trash2 className="h-4 w-4" />
        </HoldConfirmButton>
      </td>
    </tr>
  )
}

function InputWithMax({
  max,
  children,
}: {
  max: number
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        /{max}
      </span>
    </div>
  )
}
