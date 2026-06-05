import { useExamStore } from '@/store/useExamStore'
import { useGradeStore } from '@/store/useGradeStore'
import { useLockinStore } from '@/store/useLockinStore'
import { useNotesStore } from '@/store/useNotesStore'

/** Clears all persisted track, notes, and exam data. */
export function resetAllAppData(): void {
  useLockinStore.getState().resetTracker()
  useNotesStore.getState().resetNotes()
  useExamStore.getState().resetExams()
  useGradeStore.getState().resetBoundaries()
}
