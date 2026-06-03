import { CalendarClock, MapPin } from 'lucide-react'
import {
  daysLeftUrgency,
  formatDaysLeft,
  formatExamDateTime,
  nextUpcomingExam,
} from '@/lib/exam-utils'
import { cn } from '@/lib/utils'
import { useExamStore } from '@/store/useExamStore'

export function ExamUpcomingPanel() {
  const exams = useExamStore((s) => s.exams)
  const next = nextUpcomingExam(exams)

  if (!next) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface/20 px-4 py-6 text-center text-sm text-muted-foreground">
        No upcoming exams scheduled.
      </section>
    )
  }

  const urgency = daysLeftUrgency(next.scheduledAt, next.status)

  return (
    <section className="rounded-lg border border-border bg-surface/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Next exam
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-foreground">{next.name}</h2>
          {next.subject && (
            <p className="text-sm text-muted-foreground">{next.subject}</p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            {formatExamDateTime(next.scheduledAt)}
          </p>
          {next.location && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {next.location}
            </p>
          )}
        </div>
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-center tabular-nums',
            urgency === 'today' &&
              'bg-urgency-today/15 text-urgency-today',
            urgency === 'soon' && 'bg-urgency-soon/15 text-urgency-soon',
            urgency === 'normal' && 'bg-muted text-foreground',
            urgency === 'past' && 'bg-muted/60 text-muted-foreground',
          )}
        >
          <p className="text-2xl font-semibold leading-none">
            {formatDaysLeft(next.scheduledAt, next.status)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">until exam</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground tabular-nums">
        <span>{next.durationMinutes} min</span>
        <span>{next.maxMarks} marks</span>
        {next.paperCode && <span>{next.paperCode}</span>}
        {next.targetGrade && <span>Target: {next.targetGrade}</span>}
      </div>
    </section>
  )
}
