import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { computeStreak } from '@/lib/streak'
import { defaultStreak } from '@/lib/storage'
import type { AppState, PracticePaper, Unit } from '@/lib/types'
import {
  DEFAULT_ROLLING_N,
  MAX_ROLLING_N,
  MAX_UNITS,
  MIN_ROLLING_N,
} from '@/lib/types'
import { generateId } from '@/lib/utils'

type UnitInput = {
  name: string
  examDurationMinutes: number
  maxMarks: number
  dailyQuota: number
  rollingN: number
}

function normalizeUnit(unit: Unit): Unit {
  const n = unit.rollingN ?? DEFAULT_ROLLING_N
  return {
    ...unit,
    rollingN: Math.min(
      MAX_ROLLING_N,
      Math.max(MIN_ROLLING_N, Math.floor(n)),
    ),
  }
}

function normalizeUnits(units: Unit[]): Unit[] {
  return normalizeSortOrder(units.map(normalizeUnit))
}

type LockinStore = AppState & {
  addUnit: (input: UnitInput) => boolean
  updateUnit: (id: string, input: UnitInput) => void
  updateUnitRollingN: (id: string, rollingN: number) => void
  deleteUnit: (id: string) => void
  moveUnit: (id: string, direction: 'up' | 'down') => void
  addPaper: (
    unitId: string,
    paper: Omit<PracticePaper, 'id'>,
  ) => boolean
  updatePaper: (
    unitId: string,
    paperId: string,
    patch: Partial<Omit<PracticePaper, 'id'>>,
  ) => boolean
  deletePaper: (unitId: string, paperId: string) => void
  deleteAllPapers: (unitId: string) => void
  deleteAllUnits: () => void
  replaceState: (state: AppState) => void
  mergeState: (state: AppState) => void
  resetTracker: () => void
  recomputeStreak: () => void
}

function withStreak(units: Unit[]): AppState['streak'] {
  return computeStreak(units)
}

function normalizeSortOrder(units: Unit[]): Unit[] {
  return units
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((unit, index) => ({ ...unit, sortOrder: index }))
}

export const useLockinStore = create<LockinStore>()(
  persist(
    (set, get) => ({
      units: [],
      streak: defaultStreak(),

      recomputeStreak: () => {
        const { units } = get()
        set({ streak: computeStreak(units) })
      },

      addUnit: (input) => {
        const { units } = get()
        if (units.length >= MAX_UNITS) return false

        const unit: Unit = {
          id: generateId(),
          name: input.name.trim(),
          examDurationMinutes: input.examDurationMinutes,
          maxMarks: input.maxMarks,
          dailyQuota: input.dailyQuota,
          rollingN: Math.min(
            MAX_ROLLING_N,
            Math.max(MIN_ROLLING_N, Math.floor(input.rollingN)),
          ),
          practicePapers: [],
          createdAt: new Date().toISOString(),
          sortOrder: units.length,
        }

        const nextUnits = [...units, unit]
        set({ units: nextUnits, streak: withStreak(nextUnits) })
        return true
      },

      updateUnit: (id, input) => {
        const { units } = get()
        const nextUnits = units.map((u) =>
          u.id === id
            ? {
                ...u,
                name: input.name.trim(),
                examDurationMinutes: input.examDurationMinutes,
                maxMarks: input.maxMarks,
                dailyQuota: input.dailyQuota,
                rollingN: Math.min(
                  MAX_ROLLING_N,
                  Math.max(MIN_ROLLING_N, Math.floor(input.rollingN)),
                ),
              }
            : u,
        )
        set({ units: nextUnits, streak: withStreak(nextUnits) })
      },

      updateUnitRollingN: (id, rollingN) => {
        const { units } = get()
        const unit = units.find((u) => u.id === id)
        if (!unit) return
        const n = Math.min(
          MAX_ROLLING_N,
          Math.max(MIN_ROLLING_N, Math.floor(rollingN)),
        )
        if (unit.rollingN === n) return
        const nextUnits = units.map((u) =>
          u.id === id ? { ...u, rollingN: n } : u,
        )
        set({ units: nextUnits, streak: withStreak(nextUnits) })
      },

      deleteUnit: (id) => {
        const { units } = get()
        const nextUnits = normalizeSortOrder(units.filter((u) => u.id !== id))
        set({ units: nextUnits, streak: withStreak(nextUnits) })
      },

      moveUnit: (id, direction) => {
        const { units } = get()
        const sorted = [...units].sort((a, b) => a.sortOrder - b.sortOrder)
        const index = sorted.findIndex((u) => u.id === id)
        if (index === -1) return

        const swapIndex = direction === 'up' ? index - 1 : index + 1
        if (swapIndex < 0 || swapIndex >= sorted.length) return

        const current = sorted[index]
        const swap = sorted[swapIndex]
        sorted[index] = { ...current, sortOrder: swap.sortOrder }
        sorted[swapIndex] = { ...swap, sortOrder: current.sortOrder }

        set({ units: sorted.sort((a, b) => a.sortOrder - b.sortOrder) })
      },

      addPaper: (unitId, paper) => {
        const { units } = get()
        const unit = units.find((u) => u.id === unitId)
        if (!unit) return false
        if (paper.marks > unit.maxMarks) return false
        if (paper.timeMinutes < 0) return false

        const nextPaper: PracticePaper = { ...paper, id: generateId() }
        const nextUnits = units.map((u) =>
          u.id === unitId
            ? { ...u, practicePapers: [...u.practicePapers, nextPaper] }
            : u,
        )
        set({ units: nextUnits, streak: withStreak(nextUnits) })
        return true
      },

      updatePaper: (unitId, paperId, patch) => {
        const { units } = get()
        const unit = units.find((u) => u.id === unitId)
        if (!unit) return false

        const existing = unit.practicePapers.find((p) => p.id === paperId)
        if (!existing) return false

        const next = { ...existing, ...patch }
        if (next.marks > unit.maxMarks) return false
        if (next.timeMinutes < 0) return false

        const nextUnits = units.map((u) =>
          u.id === unitId
            ? {
                ...u,
                practicePapers: u.practicePapers.map((p) =>
                  p.id === paperId ? next : p,
                ),
              }
            : u,
        )
        set({ units: nextUnits, streak: withStreak(nextUnits) })
        return true
      },

      deletePaper: (unitId, paperId) => {
        const { units } = get()
        const nextUnits = units.map((u) =>
          u.id === unitId
            ? {
                ...u,
                practicePapers: u.practicePapers.filter((p) => p.id !== paperId),
              }
            : u,
        )
        set({ units: nextUnits, streak: withStreak(nextUnits) })
      },

      deleteAllPapers: (unitId) => {
        const { units } = get()
        const unit = units.find((u) => u.id === unitId)
        if (!unit || unit.practicePapers.length === 0) return

        const nextUnits = units.map((u) =>
          u.id === unitId ? { ...u, practicePapers: [] } : u,
        )
        set({ units: nextUnits, streak: withStreak(nextUnits) })
      },

      deleteAllUnits: () => {
        const { units } = get()
        if (units.length === 0) return
        set({ units: [], streak: withStreak([]) })
      },

      replaceState: (state) => {
        set({
          units: normalizeUnits(state.units).slice(0, MAX_UNITS),
          streak: state.streak,
        })
        get().recomputeStreak()
      },

      mergeState: (state) => {
        const { units } = get()
        const existingIds = new Set(units.map((u) => u.id))
        const merged = normalizeUnits([
          ...units,
          ...state.units.filter((u) => !existingIds.has(u.id)),
        ]).slice(0, MAX_UNITS)

        set({
          units: merged,
          streak: withStreak(merged),
        })
      },

      resetTracker: () => {
        set({ units: [], streak: defaultStreak() })
      },
    }),
    {
      name: 'lockin-v1',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.units = normalizeUnits(state.units)
        state.recomputeStreak()
      },
    },
  ),
)
