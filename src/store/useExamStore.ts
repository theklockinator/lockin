import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Exam, ExamInput } from '@/lib/exam-types'
import { MAX_EXAMS } from '@/lib/exam-types'
import { generateId } from '@/lib/utils'

type ExamStore = {
  exams: Exam[]
  addExam: (input: ExamInput) => boolean
  updateExam: (id: string, patch: Partial<ExamInput>) => boolean
  deleteExam: (id: string) => void
  deleteAllExams: () => void
  moveExam: (id: string, direction: 'up' | 'down') => void
  replaceExams: (exams: Exam[]) => void
  resetExams: () => void
}

function normalizeExam(exam: Exam): Exam {
  return {
    ...exam,
    marksAchieved:
      exam.marksAchieved === undefined || exam.marksAchieved === null
        ? null
        : exam.marksAchieved,
  }
}

function normalizeSortOrder(exams: Exam[]): Exam[] {
  return [...exams]
    .map(normalizeExam)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((exam, index) => ({ ...exam, sortOrder: index }))
}

function isValidMarksAchieved(
  marksAchieved: number,
  maxMarks: number,
): boolean {
  return (
    Number.isFinite(marksAchieved) &&
    marksAchieved >= 0 &&
    marksAchieved <= maxMarks
  )
}

function applyPatch(exam: Exam, patch: Partial<ExamInput>): Exam {
  return {
    ...exam,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : exam.name,
    links: patch.links ?? exam.links,
  }
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      exams: [],

      addExam: (input) => {
        const { exams } = get()
        if (exams.length >= MAX_EXAMS) return false
        if (!input.name.trim() || !input.scheduledAt) return false

        const exam: Exam = {
          id: generateId(),
          name: input.name.trim(),
          durationMinutes: input.durationMinutes,
          maxMarks: input.maxMarks,
          marksAchieved: input.marksAchieved ?? null,
          scheduledAt: input.scheduledAt,
          location: input.location.trim(),
          links: input.links,
          subject: input.subject.trim(),
          paperCode: input.paperCode.trim(),
          seatNumber: input.seatNumber.trim(),
          materials: input.materials.trim(),
          status: input.status,
          targetGrade: input.targetGrade.trim(),
          notes: input.notes.trim(),
          sortOrder: exams.length,
          createdAt: new Date().toISOString(),
        }

        set({ exams: [...exams, exam] })
        return true
      },

      updateExam: (id, patch) => {
        const { exams } = get()
        const exam = exams.find((e) => e.id === id)
        if (!exam) return false
        if (patch.name !== undefined && !patch.name.trim()) return false
        if (patch.scheduledAt !== undefined && !patch.scheduledAt) return false

        const next = applyPatch(exam, patch)
        const maxMarks = next.maxMarks
        if (
          next.marksAchieved !== null &&
          !isValidMarksAchieved(next.marksAchieved, maxMarks)
        ) {
          return false
        }

        set({
          exams: exams.map((e) => (e.id === id ? next : e)),
        })
        return true
      },

      deleteExam: (id) => {
        const { exams } = get()
        set({ exams: normalizeSortOrder(exams.filter((e) => e.id !== id)) })
      },

      deleteAllExams: () => {
        const { exams } = get()
        if (exams.length === 0) return
        set({ exams: [] })
      },

      moveExam: (id, direction) => {
        const { exams } = get()
        const sorted = [...exams].sort((a, b) => a.sortOrder - b.sortOrder)
        const index = sorted.findIndex((e) => e.id === id)
        if (index === -1) return

        const swapIndex = direction === 'up' ? index - 1 : index + 1
        if (swapIndex < 0 || swapIndex >= sorted.length) return

        const current = sorted[index]
        const swap = sorted[swapIndex]
        sorted[index] = { ...current, sortOrder: swap.sortOrder }
        sorted[swapIndex] = { ...swap, sortOrder: current.sortOrder }

        set({ exams: sorted.sort((a, b) => a.sortOrder - b.sortOrder) })
      },

      replaceExams: (exams) => {
        set({ exams: normalizeSortOrder(exams).slice(0, MAX_EXAMS) })
      },

      resetExams: () => {
        set({ exams: [] })
      },
    }),
    {
      name: 'lockin-exams-v1',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.exams = normalizeSortOrder(state.exams)
      },
    },
  ),
)
