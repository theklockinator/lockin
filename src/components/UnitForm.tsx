import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalField } from '@/components/ui/decimal-input'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { parseDecimalInput } from '@/lib/decimal-input'
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
    const examDurationMinutes = parseDecimalInput(duration)
    const max = parseDecimalInput(maxMarks)
    const dailyQuota = parseDecimalInput(quota)

    if (!trimmed) {
      setError('Name is required.')
      return
    }
    if (
      examDurationMinutes === null ||
      examDurationMinutes <= 0 ||
      max === null ||
      max <= 0 ||
      dailyQuota === null ||
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
            <DecimalField
              id="unit-duration"
              value={duration}
              onChange={setDuration}
            />
          </Field>
          <Field label="Max marks" htmlFor="unit-max-marks">
            <DecimalField
              id="unit-max-marks"
              value={maxMarks}
              onChange={setMaxMarks}
            />
          </Field>
          <Field label="Daily quota" htmlFor="unit-quota">
            <DecimalField
              id="unit-quota"
              value={quota}
              onChange={setQuota}
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
