import { format } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MAX_EXAMS } from '@/lib/exam-types'
import { numberInputNoSpin } from '@/lib/form-classes'
import { parseLinksText } from '@/lib/exam-utils'
import { useExamStore } from '@/store/useExamStore'

function currentDatetimeLocal(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

export function ExamForm() {
  const exams = useExamStore((s) => s.exams)
  const addExam = useExamStore((s) => s.addExam)
  const atLimit = exams.length >= MAX_EXAMS

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [maxMarks, setMaxMarks] = useState('')
  const [scheduledAt, setScheduledAt] = useState(currentDatetimeLocal)
  const [location, setLocation] = useState('')
  const [linksText, setLinksText] = useState('')
  const [subject, setSubject] = useState('')
  const [paperCode, setPaperCode] = useState('')
  const [seatNumber, setSeatNumber] = useState('')
  const [materials, setMaterials] = useState('')
  const [targetGrade, setTargetGrade] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDuration('')
    setMaxMarks('')
    setScheduledAt(currentDatetimeLocal())
    setLocation('')
    setLinksText('')
    setSubject('')
    setPaperCode('')
    setSeatNumber('')
    setMaterials('')
    setTargetGrade('')
    setNotes('')
    setError(null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (atLimit) return

    const trimmed = name.trim()
    const durationMinutes = Number(duration)
    const max = Number(maxMarks)

    if (!trimmed) {
      setError('Exam name is required.')
      return
    }
    if (!scheduledAt) {
      setError('Date and time are required.')
      return
    }
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0 ||
      !Number.isFinite(max) ||
      max <= 0
    ) {
      setError('Duration and max marks must be positive numbers.')
      return
    }

    const ok = addExam({
      name: trimmed,
      durationMinutes,
      maxMarks: max,
      scheduledAt,
      location,
      links: parseLinksText(linksText),
      subject,
      paperCode,
      seatNumber,
      materials,
      status: 'upcoming',
      targetGrade,
      notes,
    })

    if (ok) reset()
    else setError(`Maximum of ${MAX_EXAMS} exams reached.`)
  }

  return (
    <section className="rounded-lg border border-border bg-surface/30 p-4">
      <h2 className="mb-4 text-sm font-medium text-foreground">Add exam</h2>
      {atLimit ? (
        <p className="text-sm text-muted-foreground">
          Maximum of {MAX_EXAMS} exams reached.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Exam name" htmlFor="exam-name">
              <Input
                id="exam-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Subject" htmlFor="exam-subject">
              <Input
                id="exam-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
            <Field label="Date & time" htmlFor="exam-datetime">
              <Input
                id="exam-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
            <Field label="Duration (min)" htmlFor="exam-duration">
              <Input
                id="exam-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={numberInputNoSpin}
              />
            </Field>
            <Field label="Max marks" htmlFor="exam-max-marks">
              <Input
                id="exam-max-marks"
                type="number"
                min={1}
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                className={numberInputNoSpin}
              />
            </Field>
            <Field label="Location" htmlFor="exam-location">
              <Input
                id="exam-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
            <Field label="Paper / board code" htmlFor="exam-paper">
              <Input
                id="exam-paper"
                value={paperCode}
                onChange={(e) => setPaperCode(e.target.value)}
              />
            </Field>
            <Field label="Seat / candidate no." htmlFor="exam-seat">
              <Input
                id="exam-seat"
                value={seatNumber}
                onChange={(e) => setSeatNumber(e.target.value)}
              />
            </Field>
            <Field label="Target grade" htmlFor="exam-target">
              <Input
                id="exam-target"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
              />
            </Field>
            <Field label="Required materials" htmlFor="exam-materials" className="sm:col-span-2">
              <Input
                id="exam-materials"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Links (one per line: label | url)"
            htmlFor="exam-links"
          >
            <textarea
              id="exam-links"
              rows={2}
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="Notes" htmlFor="exam-notes">
            <textarea
              id="exam-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground  focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button type="submit">Add exam</Button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </form>
      )}
    </section>
  )
}
