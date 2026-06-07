import { describe, expect, it } from 'vitest'
import { boundariesToPiecewiseFormula, formulaGradeBands } from './grade-formula'
import {
  DEFAULT_GRADE_BOUNDARIES,
  percentToGrade,
  resolveGradeMinPercent,
  type GradeBoundarySettings,
} from './grade-boundaries'
import { evaluateGradeFormula } from './grade-formula'

function gradeAt(formula: string, percent: number): string {
  const ev = evaluateGradeFormula(formula, percent)
  expect(ev.ok).toBe(true)
  if (!ev.ok) return ''
  return ev.grade
}

describe('grade-formula', () => {
  it('evaluates CHAR as unshifted ASCII code', () => {
    expect(gradeAt('y = CHAR(65)', 0)).toBe('A')
    expect(gradeAt('y = CHAR(69)', 0)).toBe('E')
    expect(gradeAt('y = CHAR(70)', 0)).toBe('F')
  })

  it('evaluates exponentiation and logarithms', () => {
    expect(gradeAt('y = 2^3', 0)).toBe('8')
    expect(gradeAt('y = 2**4', 0)).toBe('16')
    expect(gradeAt('y = 2^3^2', 0)).toBe('512')
    expect(gradeAt('y = pow(x, 2)', 5)).toBe('25')
    expect(gradeAt('y = round(exp(1))', 0)).toBe('3')
    expect(gradeAt('y = round(ln(exp(2)))', 0)).toBe('2')
    expect(gradeAt('y = round(log(1000))', 0)).toBe('3')
    expect(gradeAt('y = round(log[2](8))', 0)).toBe('3')
    expect(gradeAt('y = round(log[10](1000))', 0)).toBe('3')
    expect(gradeAt('y = ln(0)', 0)).toBe('0')
  })

  it('evaluates round with precision argument', () => {
    expect(gradeAt('y = round(3.14159, 2)', 0)).toBe('3.14')
    expect(gradeAt('y = round(1234, -2)', 0)).toBe('1200')
    expect(gradeAt('y = round(7.89)', 0)).toBe('8')
  })

  it('evaluates min and max with more than two arguments', () => {
    expect(gradeAt('y = min(3, 1, 2)', 0)).toBe('1')
    expect(gradeAt('y = max(3, 1, 2)', 0)).toBe('3')
    expect(gradeAt('y = min(5, max(0, 2, 3))', 0)).toBe('3')
  })

  it('evaluates CHAR linear GCSE-style formula with ASCII offset', () => {
    const formula = 'y = CHAR(floor(min(max(7.8-0.08x,0),4))+65)'
    expect(gradeAt(formula, 0)).toBe('E')
    expect(gradeAt(formula, 47.5)).toBe('E')
    expect(gradeAt(formula, 48)).toBe('D')
  })

  it('evaluates piecewise with chained range conditions', () => {
    const formula =
      'y = {0<=x<30:x,30<=x<40:2x-30,40<=x<70:5x/3-50/3,70<=x<75:100}'
    expect(gradeAt(formula, 20)).toBe('20')
    expect(gradeAt(formula, 35)).toBe('40')
    expect(gradeAt(formula, 50)).toBe('66.666667')
    expect(gradeAt(formula, 72)).toBe('100')
  })

  it('evaluates piecewise with string grades', () => {
    const formula = 'y = {x<50:"F", "A"}'
    expect(gradeAt(formula, 30)).toBe('F')
    expect(gradeAt(formula, 60)).toBe('A')
  })

  it('evaluates piecewise with CHAR ASCII codes', () => {
    const formula = 'y = CHAR({x<50:70,65})'
    expect(gradeAt(formula, 40)).toBe('F')
    expect(gradeAt(formula, 55)).toBe('A')
  })

  it('evaluates LABEL with 1-based index into string args', () => {
    expect(gradeAt('y = LABEL(1, "A*", "A", "B")', 0)).toBe('A*')
    expect(gradeAt('y = LABEL(2, "A*", "A", "B")', 0)).toBe('A')
    expect(gradeAt('y = LABEL(3, "A*", "A", "B")', 0)).toBe('B')
    expect(gradeAt('y = LABEL(9, "U", "E", "D")', 0)).toBe('D')
  })

  it('evaluates LABEL with implicit multiply in index expression', () => {
    const formula = 'y = LABEL(3(x+0.01)/100,"U","A*")'
    expect(gradeAt(formula, 0)).toBe('U')
    expect(gradeAt(formula, 33)).toBe('U')
    expect(gradeAt(formula, 50)).toBe('A*')
  })

  it('evaluates k-format suffix', () => {
    const formula = 'y = k0.04x" GPA"'
    expect(gradeAt(formula, 90)).toBe('3.6 GPA')
  })

  it('evaluates k-format with bare x', () => {
    expect(gradeAt('y = kx"%"', 75)).toBe('75%')
  })

  it('merges linear k-format bands when group linear is on', () => {
    const bands = formulaGradeBands('y = k0.01x"a"', { groupLinear: true })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toEqual([
      { grade: '0a–1a', fromPercent: 0, toPercent: 100 },
    ])
  })

  it('keeps separate bands when group linear is off', () => {
    const bands = formulaGradeBands('y = k0.01x"a"', { groupLinear: false })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands.length).toBeGreaterThan(50)
  })

  it('does not group x^2 with group linear alone', () => {
    const bands = formulaGradeBands('y = x^2', {
      groupLinear: true,
      groupNonLinear: false,
    })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands.length).toBeGreaterThan(10)
  })

  it('groups x^2 with group non-linear', () => {
    const bands = formulaGradeBands('y = x^2', {
      groupLinear: false,
      groupNonLinear: true,
    })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toEqual([
      { grade: '0–10000', fromPercent: 0, toPercent: 100 },
    ])
  })

  it('evaluates piecewise numeric else without float noise', () => {
    const formula = 'y = {x<90:x^2,8082.01}'
    expect(gradeAt(formula, 89.9)).toBe('8082.01')
    expect(gradeAt(formula, 90)).toBe('8082.01')
  })

  it('splits nested piecewise inside round into separate preview groups', () => {
    const formula =
      'y = round({0<=x<40:0.75x,40<=x<160/3:1.5x-30,160/3<=x<280/3:1.25x-50/3,280/3<=x<100:100})'
    const bands = formulaGradeBands(formula, {
      groupLinear: true,
      groupNonLinear: true,
    })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toHaveLength(4)
    expect(bands[0]).toEqual({ grade: '0–30', fromPercent: 0, toPercent: 39.9 })
    expect(bands[1]).toEqual({ grade: '30–50', fromPercent: 40, toPercent: 53.3 })
    expect(bands[2]).toEqual({ grade: '50–100', fromPercent: 53.4, toPercent: 93.3 })
    expect(bands[3]).toEqual({ grade: '100', fromPercent: 93.4, toPercent: 100 })
  })

  it('splits piecewise branches into separate preview groups', () => {
    const formula = 'y = {x<90:x^2,x>=90:8082.01}'
    const bands = formulaGradeBands(formula, {
      groupLinear: false,
      groupNonLinear: true,
    })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toHaveLength(2)
    expect(bands[0]).toEqual({
      grade: '0–8082.01',
      fromPercent: 0,
      toPercent: 89.9,
    })
    expect(bands[1]).toEqual({
      grade: '8082.01',
      fromPercent: 90,
      toPercent: 100,
    })
  })

  it('uses non-linear grouping when both group checkboxes are on', () => {
    const formula = 'y = {x<90:x^2,x>=90:8082.01}'
    const bands = formulaGradeBands(formula, {
      groupLinear: true,
      groupNonLinear: true,
    })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toHaveLength(2)
    expect(bands[0]?.grade).toBe('0–8082.01')
    expect(bands[1]?.grade).toBe('8082.01')
  })

  it('rounds CHAR(x) band edges at 0.1% steps', () => {
    const bands = formulaGradeBands('y = CHAR(x)', { groupLinear: false })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands[0]).toEqual({
      grade: String.fromCharCode(0),
      fromPercent: 0,
      toPercent: 0.4,
    })
    expect(bands[1]).toEqual({
      grade: String.fromCharCode(1),
      fromPercent: 0.5,
      toPercent: 1.4,
    })
    const plus = bands.find((b) => b.grade === '+')
    expect(plus).toEqual({ grade: '+', fromPercent: 42.5, toPercent: 43.4 })
  })

  it('evaluates piecewise with expression bounds in range conditions', () => {
    const plain =
      'y = {0<=x<40:0.75x,40<=x<160/3:1.5x-30,160/3<=x<280/3:1.25x-50/3,280/3<=x<100:100}'
    const grouped =
      'y = {0<=x<40:0.75x,40<=x<(160/3):1.5x-30,(160/3)<=x<(280/3):1.25x-50/3,(280/3)<=x<100:100}'
    for (const formula of [plain, grouped]) {
      expect(gradeAt(formula, 20)).toBe('15')
      expect(gradeAt(formula, 50)).toBe('45')
      expect(gradeAt(formula, 88)).toBe('93.333333')
      expect(gradeAt(formula, 94)).toBe('100')
    }
  })

  it('groups piecewise linear branch with repeating-decimal step when group linear is on', () => {
    const formula =
      'y = {0<=x<30:x,30<=x<40:2x-30,40<=x<70:5x/3-50/3,70<=x<75:100}'
    const bands = formulaGradeBands(formula, {
      groupLinear: true,
      groupNonLinear: false,
    })
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toEqual([
      { grade: '0–29.9', fromPercent: 0, toPercent: 29.9 },
      { grade: '30–49.8', fromPercent: 30, toPercent: 39.9 },
      { grade: '50–99.833333', fromPercent: 40, toPercent: 69.9 },
      { grade: '100', fromPercent: 70, toPercent: 100 },
    ])
  })

  it('builds preview bands at grade changes', () => {
    const bands = formulaGradeBands('y = {x<50:"F", "A"}')
    expect('error' in bands).toBe(false)
    if ('error' in bands) return
    expect(bands).toEqual([
      { grade: 'F', fromPercent: 0, toPercent: 49.9 },
      { grade: 'A', fromPercent: 50, toPercent: 100 },
    ])
  })

  it('exports table boundaries to piecewise formula', () => {
    const f = boundariesToPiecewiseFormula(DEFAULT_GRADE_BOUNDARIES)
    expect(f).toContain('x>=90')
    expect(f).toContain('A*')
    expect(gradeAt(f, 92)).toBe('A*')
    expect(gradeAt(f, 75)).toBe('B')
  })
})

describe('grade settings integration', () => {
  const formulaSettings: GradeBoundarySettings = {
    mode: 'formula',
    boundaries: DEFAULT_GRADE_BOUNDARIES,
    formula: 'y = {x<50:"F", "A"}',
  }

  it('percentToGrade uses formula mode', () => {
    expect(percentToGrade(40, formulaSettings).grade).toBe('F')
    expect(percentToGrade(80, formulaSettings).grade).toBe('A')
  })

  it('resolveGradeMinPercent finds threshold in formula mode', () => {
    expect(resolveGradeMinPercent('A', formulaSettings)).toBe(50)
    expect(resolveGradeMinPercent('F', formulaSettings)).toBe(0)
  })
})
