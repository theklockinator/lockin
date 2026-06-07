import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import {
  DEFAULT_GRADE_BOUNDARIES,
  DEFAULT_GRADE_FORMULA,
  DEFAULT_GRADE_SETTINGS,
  normalizeBoundaries,
  normalizeGradeSettings,
  type GradeBoundary,
  type GradeBoundaryMode,
  type GradeBoundarySettings,
} from '@/lib/grade-boundaries'
import { boundariesToPiecewiseFormula } from '@/lib/grade-formula'

type GradeStore = GradeBoundarySettings & {
  groupLinearBands: boolean
  groupNonLinearBands: boolean
  setSettings: (settings: Partial<GradeBoundarySettings>) => void
  setMode: (mode: GradeBoundaryMode) => void
  setFormula: (formula: string) => void
  setGroupLinearBands: (groupLinearBands: boolean) => void
  setGroupNonLinearBands: (groupNonLinearBands: boolean) => void
  setBoundaries: (boundaries: GradeBoundary[]) => void
  updateBoundary: (
    index: number,
    patch: Partial<GradeBoundary>,
  ) => void
  addBoundary: () => void
  removeBoundary: (index: number) => void
  resetBoundaries: () => void
  exportBoundariesToFormula: () => void
}

export const useGradeStore = create<GradeStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_GRADE_SETTINGS,
      groupLinearBands: true,
      groupNonLinearBands: false,

      setSettings: (settings) => {
        set(normalizeGradeSettings({ ...get(), ...settings }))
      },

      setMode: (mode) => {
        set({ mode })
      },

      setFormula: (formula) => {
        set({ formula: formula.trim() })
      },

      setGroupLinearBands: (groupLinearBands) => {
        set({ groupLinearBands })
      },

      setGroupNonLinearBands: (groupNonLinearBands) => {
        set({ groupNonLinearBands })
      },

      setBoundaries: (boundaries) => {
        const normalized = normalizeBoundaries(boundaries)
        set({ boundaries: normalized })
      },

      updateBoundary: (index, patch) => {
        const next = [...get().boundaries]
        const row = next[index]
        if (!row) return
        next[index] = {
          grade: patch.grade !== undefined ? patch.grade : row.grade,
          minPercent:
            patch.minPercent !== undefined
              ? patch.minPercent
              : row.minPercent,
        }
        set({ boundaries: normalizeBoundaries(next) })
      },

      addBoundary: () => {
        const { boundaries } = get()
        const minUsed = Math.min(...boundaries.map((b) => b.minPercent), 50)
        set({
          boundaries: normalizeBoundaries([
            ...boundaries,
            { grade: 'New', minPercent: Math.max(0, minUsed - 10) },
          ]),
        })
      },

      removeBoundary: (index) => {
        const next = get().boundaries.filter((_, i) => i !== index)
        if (next.length === 0) return
        set({ boundaries: normalizeBoundaries(next) })
      },

      resetBoundaries: () => {
        set({
          mode: 'table',
          boundaries: DEFAULT_GRADE_BOUNDARIES,
          formula: DEFAULT_GRADE_FORMULA,
        })
      },

      exportBoundariesToFormula: () => {
        const { boundaries } = get()
        set({
          formula: boundariesToPiecewiseFormula(boundaries),
          mode: 'formula',
        })
      },
    }),
    {
      name: 'lockin-grades-v2',
      migrate: (persisted) => {
        const old = persisted as {
          boundaries?: GradeBoundary[]
          mode?: GradeBoundaryMode
          formula?: string
          groupLinearBands?: boolean
          groupNonLinearBands?: boolean
        }
        return {
          ...normalizeGradeSettings({
            mode: old.mode,
            formula: old.formula,
            boundaries: old.boundaries ?? DEFAULT_GRADE_BOUNDARIES,
          }),
          groupLinearBands: old.groupLinearBands ?? true,
          groupNonLinearBands: old.groupNonLinearBands ?? false,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const normalized = normalizeGradeSettings(state)
        state.mode = normalized.mode
        state.boundaries = normalized.boundaries
        state.formula = normalized.formula
        state.groupLinearBands = state.groupLinearBands ?? true
        state.groupNonLinearBands = state.groupNonLinearBands ?? false
      },
    },
  ),
)

export function selectGradeSettings(state: GradeStore): GradeBoundarySettings {
  return {
    mode: state.mode === 'formula' ? 'formula' : 'table',
    boundaries: state.boundaries ?? DEFAULT_GRADE_BOUNDARIES,
    formula: state.formula?.trim() || DEFAULT_GRADE_FORMULA,
  }
}

/** Stable selector — avoid returning fresh objects from useGradeStore(selector). */
export function useGradeSettings(): GradeBoundarySettings {
  return useGradeStore(
    useShallow((state) => ({
      mode: state.mode === 'formula' ? 'formula' : 'table',
      boundaries: state.boundaries ?? DEFAULT_GRADE_BOUNDARIES,
      formula: state.formula?.trim() || DEFAULT_GRADE_FORMULA,
    })),
  )
}
