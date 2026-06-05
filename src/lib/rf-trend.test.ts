import { describe, expect, it } from 'vitest'
import type { MarksRegression } from './stats-prediction'
import { analyzeRfTrends } from './rf-trend'

function mockRegression(
  predict: (hours: number, timeUsed: number) => number,
  training: { hours: number; timeUsedPercent: number }[],
  nowHours?: number,
): MarksRegression {
  const originMs = 0
  const endHours = nowHours ?? training[training.length - 1]?.hours ?? 0
  const endTime =
    training[training.length - 1]?.timeUsedPercent ?? 90
  return {
    predict: ({ hours, timeUsedPercent }) =>
      predict(hours, timeUsedPercent),
    predictAtMs: (atMs, timeUsed) =>
      predict(atMs / 3_600_000, timeUsed),
    imputedTimeUsedPercent: 90,
    predictPercentNow: predict(endHours, endTime),
    originMs,
    curve: [],
    trainingPoints: training.map((t) => ({
      hours: t.hours,
      timeUsedPercent: t.timeUsedPercent,
      marksPercent: predict(t.hours, t.timeUsedPercent),
    })),
    nowPoint: {
      hours: endHours,
      timeUsedPercent: endTime,
      predictedPercent: predict(endHours, endTime),
    },
  }
}

const marksTraining = (hours: number[]) =>
  hours.map((h) => ({ hours: h, timeUsedPercent: 90 }))

describe('rf-trend', () => {
  it('classifies improving slope', () => {
    const reg = mockRegression(
      (h) => 40 + h * 2,
      marksTraining([1, 5, 10, 15, 20]),
    )
    const r = analyzeRfTrends(reg)
    expect(r.grade).toBe('improving')
  })

  it('classifies getting slower when papers take more exam time over practice', () => {
    const reg = mockRegression(
      (h, t) => 40 + h * 0.1 + t * 0.05,
      [
        { hours: 1, timeUsedPercent: 50 },
        { hours: 5, timeUsedPercent: 62 },
        { hours: 10, timeUsedPercent: 74 },
        { hours: 15, timeUsedPercent: 86 },
        { hours: 20, timeUsedPercent: 98 },
      ],
    )
    const r = analyzeRfTrends(reg)
    expect(r.time).toBe('getting-slower')
    expect(r.timeDetail).toMatch(/slower per practice hr/)
  })

  it('classifies getting faster when papers take less exam time over practice', () => {
    const reg = mockRegression(
      (_h, t) => 80 - t * 0.2,
      [
        { hours: 1, timeUsedPercent: 95 },
        { hours: 5, timeUsedPercent: 80 },
        { hours: 10, timeUsedPercent: 65 },
        { hours: 15, timeUsedPercent: 50 },
        { hours: 20, timeUsedPercent: 35 },
      ],
    )
    const r = analyzeRfTrends(reg)
    expect(r.time).toBe('getting-faster')
    expect(r.timeDetail).toMatch(/quicker per practice hr/)
  })

  it('returns insufficient without regression', () => {
    expect(analyzeRfTrends(null).grade).toBe('insufficient')
  })

  it('classifies steady pace for moderate % time slope', () => {
    const reg = mockRegression(
      (_h, t) => 50 + t * 0.1,
      [
        { hours: 1, timeUsedPercent: 70 },
        { hours: 5, timeUsedPercent: 72 },
        { hours: 10, timeUsedPercent: 74 },
        { hours: 15, timeUsedPercent: 76 },
        { hours: 20, timeUsedPercent: 78 },
      ],
    )
    const r = analyzeRfTrends(reg)
    expect(r.time).toBe('steady-pace')
    expect(r.timeDetail).toMatch(/flat|same/)
  })
})
