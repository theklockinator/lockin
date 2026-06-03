import { Input } from '@/components/ui/input'
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
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(v)
        }}
        className={`${numberInputClass} ${inputWidth}`}
      />
    </label>
  )
}
