import { useState } from 'react'
import { ExamForm } from '@/components/ExamForm'
import { ExamGrid } from '@/components/ExamGrid'
import { ExamUpcomingPanel } from '@/components/ExamUpcomingPanel'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useExamStore } from '@/store/useExamStore'

export function ExamTab() {
  const exams = useExamStore((s) => s.exams)
  const deleteAllExams = useExamStore((s) => s.deleteAllExams)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  return (
    <section className="space-y-6">
      <ExamUpcomingPanel />
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">Exam schedule</h2>
          {exams.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-red-500 underline-offset-2 hover:bg-transparent hover:text-red-400 hover:underline"
              onClick={() => setConfirmDeleteAll(true)}
            >
              Delete all exams
            </Button>
          )}
        </div>
        <ExamGrid />
      </div>
      <ExamForm />

      <Dialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title="Delete all exams?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          This removes all {exams.length} exam
          {exams.length === 1 ? '' : 's'} from your schedule. This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmDeleteAll(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              deleteAllExams()
              setConfirmDeleteAll(false)
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
