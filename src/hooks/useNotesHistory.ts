import { useCallback, useEffect, useRef } from 'react'
import { cloneNotesState } from '@/lib/notes-geometry'
import type { NotesState } from '@/lib/notes-types'
import { useNotesStore } from '@/store/useNotesStore'

const MAX_HISTORY = 50

export function useNotesHistory() {
  const textBoxes = useNotesStore((s) => s.textBoxes)
  const strokes = useNotesStore((s) => s.strokes)
  const images = useNotesStore((s) => s.images ?? [])
  const replaceNotes = useNotesStore((s) => s.replaceNotes)
  const resetGeneration = useNotesStore((s) => s.resetGeneration)

  const pastRef = useRef<NotesState[]>([])
  const futureRef = useRef<NotesState[]>([])

  useEffect(() => {
    pastRef.current = []
    futureRef.current = []
  }, [resetGeneration])

  const snapshot = useCallback(
    (): NotesState => cloneNotesState({ textBoxes, strokes, images }),
    [textBoxes, strokes, images],
  )

  const commit = useCallback(
    (next: NotesState) => {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot()]
      futureRef.current = []
      replaceNotes(cloneNotesState(next))
    },
    [snapshot, replaceNotes],
  )

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(snapshot())
    replaceNotes(prev)
  }, [snapshot, replaceNotes])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(snapshot())
    replaceNotes(next)
  }, [snapshot, replaceNotes])

  return { snapshot, commit, undo, redo }
}
