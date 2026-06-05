import { cumulativePracticeHours, practiceHoursAtMs } from './practice-hours'

export type RfSample = {
  /** Cumulative practice hours at this paper */
  hours: number
  /** Time used % (paper minutes / unit exam duration) */
  timeUsedPercent: number
  y: number
}

export type RfPredictInput = {
  hours: number
  timeUsedPercent: number
}

function clampPercent(y: number): number {
  return Math.min(100, Math.max(0, y))
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

type TreeNode =
  | { leaf: true; value: number }
  | {
      leaf: false
      featureIndex: 0 | 1
      threshold: number
      left: TreeNode
      right: TreeNode
    }

function featureValue(sample: RfSample, index: 0 | 1): number {
  return index === 0 ? sample.hours : sample.timeUsedPercent
}

function splitSamples(
  samples: RfSample[],
  featureIndex: 0 | 1,
  threshold: number,
): [RfSample[], RfSample[]] {
  const left: RfSample[] = []
  const right: RfSample[] = []
  for (const s of samples) {
    if (featureValue(s, featureIndex) <= threshold) left.push(s)
    else right.push(s)
  }
  return [left, right]
}

function variance(values: number[]): number {
  if (values.length === 0) return 0
  const m = mean(values)
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length
}

function thresholdCandidates(samples: RfSample[], featureIndex: 0 | 1): number[] {
  const values = samples.map((s) => featureValue(s, featureIndex))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const candidates = new Set<number>()
  for (let i = 0; i < 8; i++) {
    candidates.add(min + ((max - min) * (i + 1)) / 9)
  }
  for (const v of values) candidates.add(v)
  return [...candidates]
}

function buildTree(
  samples: RfSample[],
  depth: number,
  maxDepth: number,
): TreeNode {
  const ys = samples.map((s) => s.y)
  if (depth >= maxDepth || samples.length <= 2) {
    return { leaf: true, value: clampPercent(mean(ys)) }
  }

  let bestFeature: 0 | 1 = 0
  let bestThreshold = 0
  let bestScore = Infinity
  let bestLeft: RfSample[] = []
  let bestRight: RfSample[] = []

  for (const featureIndex of [0, 1] as const) {
    const values = samples.map((s) => featureValue(s, featureIndex))
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (max - min < 1e-6) continue

    for (const threshold of thresholdCandidates(samples, featureIndex)) {
      const [left, right] = splitSamples(samples, featureIndex, threshold)
      if (left.length === 0 || right.length === 0) continue
      const score =
        left.length * variance(left.map((s) => s.y)) +
        right.length * variance(right.map((s) => s.y))
      if (score < bestScore) {
        bestScore = score
        bestFeature = featureIndex
        bestThreshold = threshold
        bestLeft = left
        bestRight = right
      }
    }
  }

  if (bestScore === Infinity) {
    return { leaf: true, value: clampPercent(mean(ys)) }
  }

  return {
    leaf: false,
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildTree(bestLeft, depth + 1, maxDepth),
    right: buildTree(bestRight, depth + 1, maxDepth),
  }
}

function predictTree(node: TreeNode, input: RfPredictInput): number {
  if (node.leaf) return node.value
  const v =
    node.featureIndex === 0 ? input.hours : input.timeUsedPercent
  return v <= node.threshold
    ? predictTree(node.left, input)
    : predictTree(node.right, input)
}

export class RandomForestRegressor {
  private trees: TreeNode[] = []

  fit(samples: RfSample[], treeCount = 24, maxDepth = 6): void {
    this.trees = []
    if (samples.length === 0) return

    const n = samples.length
    for (let t = 0; t < treeCount; t++) {
      const bag: RfSample[] = []
      for (let i = 0; i < n; i++) {
        bag.push(samples[Math.floor(Math.random() * n)]!)
      }
      this.trees.push(buildTree(bag, 0, maxDepth))
    }
  }

  predict(input: RfPredictInput): number {
    if (this.trees.length === 0) return 0
    const preds = this.trees.map((tree) => predictTree(tree, input))
    return clampPercent(mean(preds))
  }
}

export type MarksRfRow = {
  atMs: number
  timeMinutes: number
  marksPercent: number
  timeUsedPercent: number
}

export function timeUsedPercent(
  timeMinutes: number,
  examDurationMinutes: number,
): number {
  if (examDurationMinutes <= 0) return 0
  return Math.round((timeMinutes / examDurationMinutes) * 1000) / 10
}

export function meanTimeUsedPercent(rows: MarksRfRow[]): number {
  if (rows.length === 0) return 100
  return (
    Math.round(
      (rows.reduce((acc, r) => acc + r.timeUsedPercent, 0) / rows.length) * 10,
    ) / 10
  )
}

function buildTrainingSamples(
  rows: MarksRfRow[],
): { samples: RfSample[]; originMs: number } | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.atMs - b.atMs)
  const originMs = sorted[0]!.atMs
  const hours = cumulativePracticeHours(sorted)
  const samples = sorted.map((r, i) => ({
    hours: hours[i]!,
    timeUsedPercent: r.timeUsedPercent,
    y: clampPercent(r.marksPercent),
  }))
  return { samples, originMs }
}

export function fitMarksRandomForest(rows: MarksRfRow[]): {
  model: RandomForestRegressor
  originMs: number
  imputedTimeUsedPercent: number
  predict: (input: RfPredictInput) => number
  predictAtMs: (atMs: number, timeUsedPercent: number) => number
} | null {
  const built = buildTrainingSamples(rows)
  if (!built || built.samples.length < 2) return null

  const model = new RandomForestRegressor()
  model.fit(built.samples)
  const imputed = meanTimeUsedPercent(rows)

  const predict = (input: RfPredictInput) => model.predict(input)

  return {
    model,
    originMs: built.originMs,
    imputedTimeUsedPercent: imputed,
    predict,
    predictAtMs: (atMs, timeUsedPct) =>
      predict({
        hours: practiceHoursAtMs(rows, atMs),
        timeUsedPercent: timeUsedPct,
      }),
  }
}

export function regressionCurve(
  predictAtMs: (atMs: number) => number,
  minMs: number,
  maxMs: number,
  steps = 48,
): { atMs: number; predictedPercent: number }[] {
  if (maxMs <= minMs) {
    const p = predictAtMs(minMs)
    return [{ atMs: minMs, predictedPercent: p }]
  }
  const out: { atMs: number; predictedPercent: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const atMs = minMs + ((maxMs - minMs) * i) / steps
    out.push({ atMs, predictedPercent: predictAtMs(atMs) })
  }
  return out
}

export function predictionGrid(
  predict: (input: RfPredictInput) => number,
  hoursMin: number,
  hoursMax: number,
  timeMin: number,
  timeMax: number,
  cols = 24,
  rows = 14,
): {
  hours: number
  timeUsedPercent: number
  predictedPercent: number
}[] {
  const cells: {
    hours: number
    timeUsedPercent: number
    predictedPercent: number
  }[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hours = hoursMin + ((hoursMax - hoursMin) * col) / (cols - 1 || 1)
      const timeUsedPercent =
        timeMin + ((timeMax - timeMin) * row) / (rows - 1 || 1)
      cells.push({
        hours,
        timeUsedPercent,
        predictedPercent: predict({ hours, timeUsedPercent }),
      })
    }
  }
  return cells
}

export function hoursToReachPercent(
  predict: (input: RfPredictInput) => number,
  targetPercent: number,
  from: RfPredictInput,
  maxExtraHours = 8760,
): number | null {
  const current = predict(from)
  if (current >= targetPercent) return 0

  const probe = predict({
    hours: from.hours + 1,
    timeUsedPercent: from.timeUsedPercent,
  })
  if (probe <= current + 0.05) return null

  let lo = from.hours
  let hi = from.hours + maxExtraHours
  while (
    predict({ hours: hi, timeUsedPercent: from.timeUsedPercent }) <
      targetPercent &&
    hi - lo < maxExtraHours
  ) {
    hi += maxExtraHours / 4
  }
  if (
    predict({ hours: hi, timeUsedPercent: from.timeUsedPercent }) <
    targetPercent
  ) {
    return null
  }

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (
      predict({ hours: mid, timeUsedPercent: from.timeUsedPercent }) >=
      targetPercent
    ) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return Math.max(0, hi - from.hours)
}
