import { useEffect, useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Input } from '@/components/ui/input'
import { useGradeStore } from '@/store/useGradeStore'

function GradeNameInput({
  value,
  onCommit,
  ...props
}: {
  value: string
  onCommit: (value: string) => void
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'>) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  const commit = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setText(value)
      return
    }
    if (trimmed !== value) onCommit(trimmed)
    else setText(trimmed)
  }

  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      {...props}
    />
  )
}

export function GradeBoundariesPanel() {
  const boundaries = useGradeStore((s) => s.boundaries)
  const updateBoundary = useGradeStore((s) => s.updateBoundary)
  const addBoundary = useGradeStore((s) => s.addBoundary)
  const removeBoundary = useGradeStore((s) => s.removeBoundary)
  const resetBoundaries = useGradeStore((s) => s.resetBoundaries)

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Edit grade names and minimum %. Higher tiers first.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addBoundary}>
          Add grade
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={resetBoundaries}>
          Reset defaults
        </Button>
      </div>
      <ul className="space-y-2">
        {boundaries.map((row, index) => (
          <li
            key={index}
            className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2"
          >
            <GradeNameInput
              value={row.grade}
              onCommit={(grade) => updateBoundary(index, { grade })}
              className="h-8"
              aria-label={`Grade name ${index + 1}`}
            />
            <div className="flex items-center gap-1">
              <DecimalInput
                value={row.minPercent}
                min={0}
                max={100}
                onValueChange={(minPercent) =>
                  updateBoundary(index, { minPercent })
                }
                className="h-8"
                aria-label={`Minimum percent for ${row.grade}`}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={boundaries.length <= 1}
              onClick={() => removeBoundary(index)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </>
  )
}
