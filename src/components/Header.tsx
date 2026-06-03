import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  downloadAppBackup,
  mergeAppBackup,
  parseAppBackup,
  replaceAppBackup,
  type AppExportPayload,
} from '@/lib/app-backup'
import { useExamStore } from '@/store/useExamStore'
import { useLockinStore } from '@/store/useLockinStore'
import { useNotesStore } from '@/store/useNotesStore'
import { StreakBadge } from './StreakBadge'

export function Header() {
  const replaceState = useLockinStore((s) => s.replaceState)
  const replaceNotes = useNotesStore((s) => s.replaceNotes)
  const replaceExams = useExamStore((s) => s.replaceExams)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<AppExportPayload | null>(
    null,
  )
  const [importError, setImportError] = useState<string | null>(null)

  const currentSnapshot = () => {
    const track = useLockinStore.getState()
    const notesState = useNotesStore.getState()
    return {
      track: { units: track.units, streak: track.streak },
      notes: {
        textBoxes: notesState.textBoxes,
        strokes: notesState.strokes,
        images: notesState.images ?? [],
      },
      exams: useExamStore.getState().exams,
    }
  }

  const handleExport = () => {
    downloadAppBackup(currentSnapshot())
  }

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      const parsed = parseAppBackup(raw)
      setPendingImport(parsed)
      setImportError(null)
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : 'Invalid backup file. Check the JSON format.',
      )
    }
  }

  const applySnapshot = (snapshot: ReturnType<typeof replaceAppBackup>) => {
    replaceState(snapshot.track)
    replaceNotes(snapshot.notes)
    replaceExams(snapshot.exams)
  }

  const confirmReplace = () => {
    if (!pendingImport) return
    applySnapshot(replaceAppBackup(pendingImport))
    setPendingImport(null)
  }

  const confirmMerge = () => {
    if (!pendingImport) return
    applySnapshot(mergeAppBackup(currentSnapshot(), pendingImport))
    setPendingImport(null)
  }

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-foreground">
            lockin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            exam focus tracker
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <StreakBadge />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
          </div>
          {importError && (
            <p className="text-xs text-red-400">{importError}</p>
          )}
        </div>
      </header>

      <Dialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Import backup"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Replace all track, notes, and exam data, or merge imported items with
          what you already have?
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={confirmMerge}>
            Merge
          </Button>
          <Button type="button" onClick={confirmReplace}>
            Replace
          </Button>
        </div>
      </Dialog>
    </>
  )
}
