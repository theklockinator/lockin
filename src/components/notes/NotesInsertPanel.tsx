import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotesInsertPanel({
  onInsertImage,
}: {
  onInsertImage: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
      <Button type="button" size="sm" variant="secondary" onClick={onInsertImage}>
        <ImagePlus className="h-4 w-4" />
        Image from computer
      </Button>
      <p className="text-xs text-muted-foreground">
        Click canvas to place a text box, or paste an image (⌘V)
      </p>
    </div>
  )
}
