import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_GRADE_BOUNDARIES,
  normalizeBoundaries,
  type GradeBoundary,
} from '@/lib/grade-boundaries'

type GradeStore = {
  boundaries: GradeBoundary[]
  setBoundaries: (boundaries: GradeBoundary[]) => void
  updateBoundary: (
    index: number,
    patch: Partial<GradeBoundary>,
  ) => void
  addBoundary: () => void
  removeBoundary: (index: number) => void
  resetBoundaries: () => void
}

export const useGradeStore = create<GradeStore>()(
  persist(
    (set, get) => ({
      boundaries: DEFAULT_GRADE_BOUNDARIES,

      setBoundaries: (boundaries) => {
        set({ boundaries: normalizeBoundaries(boundaries) })
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
        set({ boundaries: DEFAULT_GRADE_BOUNDARIES })
      },
    }),
    {
      name: 'lockin-grades-v1',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.boundaries = normalizeBoundaries(state.boundaries)
      },
    },
  ),
)
