import { describe, expect, it } from 'vitest'
import {
  buildChartHoverSnapshot,
  formatChartTimeHover,
  MAX_TIME_PERCENT_AXIS_LABELS,
  timePercentAxisTicks,
} from './stats-chart-hover'
import type { ChartPoint } from './stats-scope'

const paper = (
  id: string,
  atMs: number,
  marks: number,
  time: number,
  timeUsedPercent: number,
): ChartPoint => ({
  key: id,
  atMs,
  completedAt: new Date(atMs).toISOString(),
  label: id,
  marksPercent: marks,
  timeMinutes: time,
  timeUsedPercent,
  paperCount: 1,
})

describe('stats-chart-hover', () => {
  it('formats time hover as minutes and percent', () => {
    expect(formatChartTimeHover(13.2, 46.3)).toBe('13 min (46.3%)')
  })

  it('limits time % axis labels', () => {
    const ticks = timePercentAxisTicks(100)
    expect(ticks.length).toBeLessThanOrEqual(MAX_TIME_PERCENT_AXIS_LABELS)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(100)
  })

  it('snaps to nearest paper within threshold', () => {
    const series = [
      paper('a', 0, 50, 60, 50),
      paper('b', 10 * 3_600_000, 70, 65, 72),
    ]
    const snap = buildChartHoverSnapshot(series, null, 10.2 * 3_600_000, 20 * 3_600_000)
    expect(snap.nearest?.key).toBe('b')
    expect(snap.marksPercent).toBe(70)
    expect(snap.interpolated).toBe(false)
  })

  it('interpolates between papers', () => {
    const series = [
      paper('a', 0, 40, 50, 40),
      paper('b', 10 * 3_600_000, 60, 70, 80),
    ]
    const mid = buildChartHoverSnapshot(series, null, 5 * 3_600_000, 10 * 3_600_000)
    expect(mid.nearest).toBeNull()
    expect(mid.marksPercent).toBe(50)
    expect(mid.timeMinutes).toBe(60)
    expect(mid.timeUsedPercent).toBe(60)
    expect(mid.interpolated).toBe(true)
  })
})
