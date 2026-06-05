import { describe, expect, it } from 'vitest'
import {
  RandomForestRegressor,
  hoursToReachPercent,
  timeUsedPercent,
} from './random-forest'

describe('random-forest', () => {
  it('predicts within 0-100', () => {
    const model = new RandomForestRegressor()
    model.fit([
      { hours: 0, timeUsedPercent: 80, y: 50 },
      { hours: 1, timeUsedPercent: 90, y: 55 },
      { hours: 2, timeUsedPercent: 70, y: 60 },
      { hours: 3, timeUsedPercent: 85, y: 70 },
    ])
    const p = model.predict({ hours: 2.5, timeUsedPercent: 75 })
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(100)
  })

  it('uses time-used percent as a second split feature', () => {
    const model = new RandomForestRegressor()
    model.fit([
      { hours: 10, timeUsedPercent: 50, y: 40 },
      { hours: 10, timeUsedPercent: 100, y: 80 },
      { hours: 20, timeUsedPercent: 50, y: 50 },
      { hours: 20, timeUsedPercent: 100, y: 90 },
    ])
    const slow = model.predict({ hours: 15, timeUsedPercent: 55 })
    const fast = model.predict({ hours: 15, timeUsedPercent: 95 })
    expect(slow).not.toBe(fast)
  })

  it('computes time used percent', () => {
    expect(timeUsedPercent(45, 90)).toBe(50)
  })

  it('estimates hours to reach target percent', () => {
    const predict = (input: { hours: number; timeUsedPercent: number }) =>
      40 + input.hours * 5
    const hours = hoursToReachPercent(predict, 80, {
      hours: 0,
      timeUsedPercent: 100,
    })
    expect(hours).not.toBeNull()
    expect(hours!).toBeGreaterThan(0)
    expect(hours!).toBeLessThan(20)
  })
})
