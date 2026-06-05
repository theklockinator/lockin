import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { parseDecimalInput } from '@/lib/decimal-input'
import { numberInputNoSpin } from '@/lib/form-classes'

export const numberInputClass = `h-7 ${numberInputNoSpin}`

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent"
      />
    </label>
  )
}

export function SizeField({
  label,
  min,
  max,
  value,
  onChange,
  inputWidth = 'w-12',
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  inputWidth?: string
}) {
  const [text, setText] = useState(() => String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  const commitText = () => {
    const parsed = parseDecimalInput(text)
    if (parsed === null) {
      setText(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    onChange(clamped)
    setText(String(clamped))
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24"
      />
      <Input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitText()
          }
        }}
        className={`${numberInputClass} ${inputWidth}`}
      />
    </label>
  )
}
