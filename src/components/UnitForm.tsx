import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DEFAULT_ROLLING_N, MAX_UNITS } from '@/lib/types'
import { useLockinStore } from '@/store/useLockinStore'

export function UnitForm() {
  const units = useLockinStore((s) => s.units)
  const addUnit = useLockinStore((s) => s.addUnit)
  const atLimit = units.length >= MAX_UNITS

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [maxMarks, setMaxMarks] = useState('')
  const [quota, setQuota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDuration('')
    setMaxMarks('')
    setQuota('')
    setError(null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (atLimit) return

    const trimmed = name.trim()
    const examDurationMinutes = Number(duration)
    const max = Number(maxMarks)
    const dailyQuota = Number(quota)

    if (!trimmed) {
      setError('Name is required.')
      return
    }
    if (
      !Number.isFinite(examDurationMinutes) ||
      examDurationMinutes <= 0 ||
      !Number.isFinite(max) ||
      max <= 0 ||
      !Number.isFinite(dailyQuota) ||
      dailyQuota <= 0
    ) {
      setError('Duration, max marks, and quota must be positive numbers.')
      return
    }

    const ok = addUnit({
      name: trimmed,
      examDurationMinutes,
      maxMarks: max,
      dailyQuota,
      rollingN: DEFAULT_ROLLING_N,
    })

    if (ok) reset()
    else setError(`Maximum of ${MAX_UNITS} units reached.`)
  }

  return (
    <section className="rounded-lg border border-border bg-surface/30 p-4">
      <h2 className="mb-4 text-sm font-medium text-foreground">Add unit</h2>
      {atLimit ? (
        <p className="text-sm text-muted-foreground">
          Maximum of {MAX_UNITS} units reached.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Field label="Unit name" htmlFor="unit-name">
            <Input
              id="unit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Exam duration (min)" htmlFor="unit-duration">
            <Input
              id="unit-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
          <Field label="Max marks" htmlFor="unit-max-marks">
            <Input
              id="unit-max-marks"
              type="number"
              min={1}
              value={maxMarks}
              onChange={(e) => setMaxMarks(e.target.value)}
            />
          </Field>
          <Field label="Daily quota" htmlFor="unit-quota">
            <Input
              id="unit-quota"
              type="number"
              min={1}
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
            />
          </Field>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <Button type="submit" className="w-full">
              Add unit
            </Button>
          </div>
        </form>
      )}
      {error && !atLimit && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </section>
  )
}
