import { ExternalLink, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { HoldConfirmButton } from '@/components/ui/hold-confirm-button'
import { Input } from '@/components/ui/input'
import { EXAM_STATUSES, type Exam, type ExamStatus } from '@/lib/exam-types'
import { formatDecimalInput, parseDecimalInput } from '@/lib/decimal-input'
import {
  daysLeftUrgency,
  formatDaysLeft,
  linksToText,
  parseLinksText,
  sortedExams,
  toDatetimeLocalValue,
} from '@/lib/exam-utils'
import { examCellTextarea, numberInputNoSpin } from '@/lib/form-classes'
import { cn } from '@/lib/utils'
import { useExamStore } from '@/store/useExamStore'

const urgencyClass: Record<
  ReturnType<typeof daysLeftUrgency>,
  string
> = {
  cancelled: 'text-muted-foreground',
  done: 'text-muted-foreground',
  past: 'text-muted-foreground',
  today: 'font-medium text-urgency-today',
  soon: 'font-medium text-urgency-soon',
  normal: 'text-foreground',
}

const numberCellClass = cn('h-8 w-full tabular-nums', numberInputNoSpin)

const fieldLabelClass =
  'mb-1 block text-[10px] font-medium leading-tight text-muted-foreground'

function FieldCell({
  label,
  children,
  className,
  rowSpan,
  colSpan,
}: {
  label: string
  children: ReactNode
  className?: string
  rowSpan?: number
  colSpan?: number
}) {
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={cn('px-1.5 py-1.5 align-top', className)}
    >
      {label ? <span className={fieldLabelClass}>{label}</span> : null}
      {children}
    </td>
  )
}

export function ExamGrid() {
  const exams = useExamStore((s) => s.exams)
  const rows = sortedExams(exams)

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Add an exam to see your schedule.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((exam) => (
            <ExamRow key={exam.id} exam={exam} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExamRow({ exam }: { exam: Exam }) {
  const updateExam = useExamStore((s) => s.updateExam)
  const deleteExam = useExamStore((s) => s.deleteExam)

  const urgency = daysLeftUrgency(exam.scheduledAt, exam.status)

  const patch = (p: Parameters<typeof updateExam>[1]) => {
    updateExam(exam.id, p)
  }

  return (
    <>
      <tr className="border-b border-border/30 align-top hover:bg-surface-elevated/30">
        <FieldCell label="Days left" rowSpan={2} className="w-[4.5rem]">
          <span
            className={cn(
              'block text-xs tabular-nums',
              urgencyClass[urgency],
            )}
          >
            {formatDaysLeft(exam.scheduledAt, exam.status)}
          </span>
        </FieldCell>
        <FieldCell label="Exam" className="min-w-[7rem]">
          <Input
            defaultValue={exam.name}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== exam.name) patch({ name: v })
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Subject" className="w-[6.5rem]">
          <Input
            defaultValue={exam.subject}
            onBlur={(e) => {
              if (e.target.value !== exam.subject) patch({ subject: e.target.value })
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Date & time" className="w-[11.5rem]">
          <Input
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(exam.scheduledAt)}
            onBlur={(e) => {
              if (
                e.target.value &&
                e.target.value !== toDatetimeLocalValue(exam.scheduledAt)
              ) {
                patch({ scheduledAt: e.target.value })
              }
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Duration" className="w-[4.5rem]">
          <Input
            type="text"
            inputMode="decimal"
            defaultValue={formatDecimalInput(exam.durationMinutes)}
            onBlur={(e) => {
              const v = parseDecimalInput(e.target.value)
              if (v !== null && v > 0 && v !== exam.durationMinutes) {
                patch({ durationMinutes: v })
              }
            }}
            className={numberCellClass}
          />
        </FieldCell>
        <FieldCell label="Marks achieved" className="w-[4.75rem]">
          <Input
            type="text"
            inputMode="decimal"
            defaultValue={
              exam.marksAchieved === null
                ? ''
                : formatDecimalInput(exam.marksAchieved)
            }
            disabled={exam.status !== 'completed'}
            readOnly={exam.status !== 'completed'}
            onBlur={(e) => {
              if (exam.status !== 'completed') return
              const raw = e.target.value.trim()
              if (raw === '') {
                if (exam.marksAchieved !== null) patch({ marksAchieved: null })
                return
              }
              const v = parseDecimalInput(raw)
              if (
                v !== null &&
                v >= 0 &&
                v <= exam.maxMarks &&
                v !== exam.marksAchieved
              ) {
                patch({ marksAchieved: v })
              }
            }}
            className={cn(
              numberCellClass,
              exam.status !== 'completed' && 'opacity-50',
            )}
          />
        </FieldCell>
        <FieldCell label="Max marks" className="w-[4.5rem]">
          <Input
            type="text"
            inputMode="decimal"
            defaultValue={formatDecimalInput(exam.maxMarks)}
            onBlur={(e) => {
              const v = parseDecimalInput(e.target.value)
              if (v !== null && v > 0 && v !== exam.maxMarks) {
                patch({ maxMarks: v })
              }
            }}
            className={numberCellClass}
          />
        </FieldCell>
        <FieldCell label="Location" className="w-[7rem]">
          <Input
            defaultValue={exam.location}
            onBlur={(e) => {
              if (e.target.value !== exam.location) patch({ location: e.target.value })
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Status" className="w-[6.5rem]">
          <select
            defaultValue={exam.status}
            onChange={(e) => patch({ status: e.target.value as ExamStatus })}
            className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground"
          >
            {EXAM_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FieldCell>
        <FieldCell label="" rowSpan={2} className="w-10">
          <HoldConfirmButton
            onConfirm={() => deleteExam(exam.id)}
            className="h-8 w-8 border-0 bg-transparent hover:bg-muted"
            title="Hold to delete exam"
            ariaLabel="Hold to delete exam"
          >
            <Trash2 className="h-4 w-4" />
          </HoldConfirmButton>
        </FieldCell>
      </tr>
      <tr className="border-b border-border/60 align-top hover:bg-surface-elevated/30">
        <FieldCell label="Paper" className="w-[5.5rem]">
          <Input
            defaultValue={exam.paperCode}
            onBlur={(e) => {
              if (e.target.value !== exam.paperCode) patch({ paperCode: e.target.value })
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Target" className="w-[4rem]">
          <Input
            defaultValue={exam.targetGrade}
            onBlur={(e) => {
              if (e.target.value !== exam.targetGrade) patch({ targetGrade: e.target.value })
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Seat" className="w-[4.5rem]">
          <Input
            defaultValue={exam.seatNumber}
            onBlur={(e) => {
              if (e.target.value !== exam.seatNumber) patch({ seatNumber: e.target.value })
            }}
            className="h-8"
          />
        </FieldCell>
        <FieldCell label="Materials" className="min-w-[8rem]">
          <textarea
            defaultValue={exam.materials}
            rows={2}
            onBlur={(e) => {
              if (e.target.value !== exam.materials) patch({ materials: e.target.value })
            }}
            className={examCellTextarea}
          />
        </FieldCell>
        <FieldCell label="Links" className="min-w-[7rem]">
          <LinksCell exam={exam} onSave={(links) => patch({ links })} />
        </FieldCell>
        <FieldCell label="Notes" className="min-w-[8rem]" colSpan={2}>
          <textarea
            defaultValue={exam.notes}
            rows={2}
            onBlur={(e) => {
              if (e.target.value !== exam.notes) patch({ notes: e.target.value })
            }}
            className={examCellTextarea}
          />
        </FieldCell>
      </tr>
    </>
  )
}

function LinksCell({
  exam,
  onSave,
}: {
  exam: Exam
  onSave: (links: Exam['links']) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const draftRef = useRef('')
  const rootRef = useRef<HTMLDivElement>(null)

  const openEditor = () => {
    const text = linksToText(exam.links)
    draftRef.current = text
    setDraft(text)
    setOpen(true)
  }

  const saveAndClose = useCallback(() => {
    const next = parseLinksText(draftRef.current)
    const prev = linksToText(exam.links)
    if (linksToText(next) !== prev) onSave(next)
    setOpen(false)
  }, [exam.links, onSave])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      saveAndClose()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') saveAndClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, saveAndClose])

  if (open) {
    return (
      <div ref={rootRef}>
        <textarea
          autoFocus
          value={draft}
          rows={3}
          onChange={(e) => {
            draftRef.current = e.target.value
            setDraft(e.target.value)
          }}
          placeholder={'Spec | https://…\nPast papers | https://…'}
          className={examCellTextarea}
        />
      </div>
    )
  }

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={openEditor}
        className="flex min-h-8 w-full items-center gap-1 rounded-md border border-border bg-surface/80 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {exam.links.length > 0 ? (
          <>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{exam.links.length} link(s)</span>
          </>
        ) : (
          'Add links'
        )}
      </button>
      {exam.links.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {exam.links.map((link) => (
            <a
              key={link.id}
              href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-link hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
