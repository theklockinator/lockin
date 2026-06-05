import { useEffect, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatDecimalInput, parseDecimalInput } from '@/lib/decimal-input'
import { numberInputNoSpin } from '@/lib/form-classes'
import { cn } from '@/lib/utils'

const decimalClass = cn(numberInputNoSpin, 'tabular-nums')

type DecimalFieldProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  value: string
  onChange: (value: string) => void
}

/** Free-text decimal field (string state); accepts comma or dot while typing. */
export function DecimalField({
  value,
  onChange,
  className,
  ...props
}: DecimalFieldProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(decimalClass, className)}
      {...props}
    />
  )
}

type DecimalInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'defaultValue' | 'value' | 'onChange' | 'onBlur'
> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
}

/** Controlled decimal input synced from a numeric value; displays with dot separator. */
export function DecimalInput({
  value,
  onValueChange,
  min,
  max,
  className,
  onKeyDown,
  ...props
}: DecimalInputProps) {
  const [text, setText] = useState(() => formatDecimalInput(value))

  useEffect(() => {
    setText(formatDecimalInput(value))
  }, [value])

  const commit = () => {
    const parsed = parseDecimalInput(text)
    if (parsed === null) {
      setText(formatDecimalInput(value))
      return
    }
    let next = parsed
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    if (next !== value) onValueChange(next)
    setText(formatDecimalInput(next))
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
        onKeyDown?.(e)
      }}
      className={cn(decimalClass, className)}
      {...props}
    />
  )
}
