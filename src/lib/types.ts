export type PracticePaper = {
  id: string
  name: string
  /** Local datetime, e.g. 2026-06-15T14:30 */
  completedAt: string
  timeMinutes: number
  marks: number
}

export type Unit = {
  id: string
  name: string
  examDurationMinutes: number
  maxMarks: number
  dailyQuota: number
  /** Number of most recent practice papers to average (replaces fixed AO3). */
  rollingN: number
  practicePapers: PracticePaper[]
  createdAt: string
  sortOrder: number
}

export const DEFAULT_ROLLING_N = 3
export const MIN_ROLLING_N = 1
export const MAX_ROLLING_N = 20

export type StreakState = {
  current: number
  longest: number
  lastPerfectDate: string | null
}

export type AppState = {
  units: Unit[]
  streak: StreakState
}

export type ExportPayload = {
  version: 1
  exportedAt: string
  units: Unit[]
  streak: StreakState
}

export const MAX_UNITS = 20
