import { describe, expect, it } from 'vitest'
import {
  formatScalePercentInput,
  heatColorForScale,
  normalizeScaleRange,
  percentFromGradientClientY,
} from './rf-surface-scale'

describe('rf-surface-scale', () => {
  it('uses midpoint hue at average of min and max', () => {
    const low = heatColorForScale(60, 60, 80)
    const mid = heatColorForScale(70, 60, 80)
    const high = heatColorForScale(80, 60, 80)
    expect(low).toContain('hsl(0 ')
    expect(mid).toContain('hsl(60 ')
    expect(high).toContain('hsl(120 ')
  })

  it('clamps below min and above max', () => {
    expect(heatColorForScale(50, 60, 80)).toBe(heatColorForScale(60, 60, 80))
    expect(heatColorForScale(90, 60, 80)).toBe(heatColorForScale(80, 60, 80))
  })

  it('keeps min strictly below max', () => {
    expect(normalizeScaleRange(80, 70)).toEqual({ min: 69, max: 70 })
  })

  it('formats scale inputs with dot decimals', () => {
    expect(formatScalePercentInput(70)).toBe('70')
    expect(formatScalePercentInput(68.5)).toBe('68.5')
  })

  it('maps gradient Y to marks percent', () => {
    const rect = { top: 0, bottom: 100, left: 0, right: 0, width: 10, height: 100, x: 0, y: 0, toJSON: () => ({}) }
    expect(percentFromGradientClientY(100, rect)).toBe(0)
    expect(percentFromGradientClientY(0, rect)).toBe(100)
    expect(percentFromGradientClientY(50, rect)).toBe(50)
  })
})
