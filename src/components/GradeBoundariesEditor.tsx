import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Input } from '@/components/ui/input'
import {
  evaluateGradeFormula,
  FORMULA_FUNCTION_REFERENCE,
  formatFormulaBandPercent,
  formulaGradeBands,
} from '@/lib/grade-formula'
import { cn } from '@/lib/utils'
import type { GradeBoundaryMode } from '@/lib/grade-boundaries'
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

const FORMULA_HELP = `x = marks %. Examples:
y = CHAR(69)   → E (raw ASCII code)
y = LABEL(2, "U", "E", "D", "C", "B", "A", "A*")
y = {x>=90:"A*",x>=80:"A","U"}
y = k0.04x" GPA"`

export function GradeBoundariesPanel() {
  const mode = useGradeStore((s) => s.mode)
  const boundaries = useGradeStore((s) => s.boundaries)
  const formula = useGradeStore((s) => s.formula)
  const setMode = useGradeStore((s) => s.setMode)
  const setFormula = useGradeStore((s) => s.setFormula)
  const updateBoundary = useGradeStore((s) => s.updateBoundary)
  const addBoundary = useGradeStore((s) => s.addBoundary)
  const removeBoundary = useGradeStore((s) => s.removeBoundary)
  const resetBoundaries = useGradeStore((s) => s.resetBoundaries)
  const exportBoundariesToFormula = useGradeStore(
    (s) => s.exportBoundariesToFormula,
  )
  const groupLinearBands = useGradeStore((s) => s.groupLinearBands)
  const groupNonLinearBands = useGradeStore((s) => s.groupNonLinearBands)
  const setGroupLinearBands = useGradeStore((s) => s.setGroupLinearBands)
  const setGroupNonLinearBands = useGradeStore((s) => s.setGroupNonLinearBands)

  const [draftFormula, setDraftFormula] = useState(formula)
  const [functionsOpen, setFunctionsOpen] = useState(false)

  useEffect(() => {
    setDraftFormula(formula)
  }, [formula])

  const formulaError = useMemo(() => {
    if (mode !== 'formula') return null
    const ev = evaluateGradeFormula(draftFormula, 50)
    if (!ev.ok) return ev.error
    return null
  }, [mode, draftFormula])

  const previewBands = useMemo(() => {
    if (mode !== 'formula' || formulaError) return []
    const bands = formulaGradeBands(draftFormula, {
      groupLinear: groupLinearBands,
      groupNonLinear: groupNonLinearBands,
    })
    if ('error' in bands) return []
    return bands
  }, [mode, draftFormula, formulaError, groupLinearBands, groupNonLinearBands])

  const commitFormula = () => {
    setFormula(draftFormula)
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {(['table', 'formula'] as GradeBoundaryMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs transition-colors',
              mode === m
                ? 'border-foreground bg-foreground text-primary-foreground'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'table' ? 'Table' : 'Formula'}
          </button>
        ))}
      </div>

      {mode === 'table' ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Edit grade names and minimum %. Higher tiers first. Names match exam
            target grades in Stats.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={addBoundary}>
              Add grade
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={exportBoundariesToFormula}
            >
              Export as piecewise formula
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
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Formula maps marks % (x) to a grade label (y). Labels are matched to
            exam target grades for time-to-target and expected grade.
          </p>
          <pre className="mb-2 whitespace-pre-wrap rounded-md border border-border bg-surface/50 p-2 text-[10px] text-muted-foreground">
            {FORMULA_HELP}
          </pre>
          <button
            type="button"
            onClick={() => setFunctionsOpen((o) => !o)}
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            aria-expanded={functionsOpen}
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                functionsOpen && 'rotate-180',
              )}
              aria-hidden
            />
            More functions
          </button>
          {functionsOpen && (
            <div className="mb-3 overflow-x-auto rounded-md border border-border bg-surface/50">
              <table className="w-full min-w-[280px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/80 text-left text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Syntax</th>
                    <th className="px-2 py-1.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {FORMULA_FUNCTION_REFERENCE.map((fn) => (
                    <tr
                      key={fn.name}
                      className="border-b border-border/60 align-top"
                    >
                      <td className="px-2 py-1.5 font-medium text-foreground">
                        {fn.name}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-foreground">
                        {fn.syntax}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {fn.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <textarea
            value={draftFormula}
            onChange={(e) => setDraftFormula(e.target.value)}
            onBlur={commitFormula}
            rows={4}
            spellCheck={false}
            className="mb-2 w-full resize-y rounded-md border border-border bg-input px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Grade boundary formula"
          />
          {formulaError && (
            <p className="mb-2 text-xs text-red-400">{formulaError}</p>
          )}
          {previewBands.length > 0 && (
            <>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={groupLinearBands}
                onChange={(e) => setGroupLinearBands(e.target.checked)}
                className="rounded border-border"
              />
              Group linear grade names (e.g. 0GPA, 0.5GPA... 4GPA → 0GPA–4GPA)
            </label>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={groupNonLinearBands}
                onChange={(e) => setGroupNonLinearBands(e.target.checked)}
                className="rounded border-border"
              />
              Group non-linear grade names (e.g. 0, 1, 4, 9... → 0–10000)
            </label>
            <div className="mb-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[240px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/80 text-left text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Grade</th>
                    <th className="px-2 py-1.5 font-medium">From %</th>
                    <th className="px-2 py-1.5 font-medium">To %</th>
                  </tr>
                </thead>
                <tbody>
                  {previewBands.map((band, i) => (
                    <tr
                      key={`${band.grade}-${band.fromPercent}-${i}`}
                      className="border-b border-border/60 tabular-nums"
                    >
                      <td className="px-2 py-1.5 font-medium text-foreground">
                        {band.grade}
                      </td>
                      <td className="px-2 py-1.5 text-foreground">
                        {formatFormulaBandPercent(band.fromPercent)}
                      </td>
                      <td className="px-2 py-1.5 text-foreground">
                        {formatFormulaBandPercent(band.toPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={exportBoundariesToFormula}
            >
              Load from table export
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetBoundaries}>
              Reset defaults
            </Button>
          </div>
        </>
      )}
    </>
  )
}
