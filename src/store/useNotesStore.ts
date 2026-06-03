import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultNotesState, normalizeNotesState } from '@/lib/notes-storage'
import type { DrawStroke, NoteImage, NoteTextBox, NotesState } from '@/lib/notes-types'
type NotesStore = NotesState & {
  replaceNotes: (state: NotesState) => void
  resetNotes: () => void
  /** Bumped on reset so in-memory undo/redo clears. */
  resetGeneration: number
}

function stateFromPersisted(persisted: unknown): NotesState {
  const p = persisted as Partial<NotesState> | undefined
  return normalizeNotesState({
    textBoxes: p?.textBoxes ?? [],
    strokes: p?.strokes ?? [],
    images: p?.images ?? [],
  })
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set, get) => ({
      ...defaultNotesState(),
      resetGeneration: 0,

      replaceNotes: (state) => {
        set(normalizeNotesState(state))
      },

      resetNotes: () => {
        set({
          ...normalizeNotesState(defaultNotesState()),
          resetGeneration: get().resetGeneration + 1,
        })
      },
    }),
    {
      name: 'lockin-notes-v1',
      partialize: (s) => ({
        textBoxes: s.textBoxes,
        strokes: s.strokes,
        images: s.images ?? [],
      }),
      merge: (persisted, current) => ({
        ...current,
        ...stateFromPersisted(persisted),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.replaceNotes(stateFromPersisted(state))
      },
    },
  ),
)

export type { NoteTextBox, NoteImage, DrawStroke }
