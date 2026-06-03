import { Flame } from 'lucide-react'
import { useLockinStore } from '@/store/useLockinStore'

export function StreakBadge() {
  const streak = useLockinStore((s) => s.streak)

  return (
    <div className="flex items-center gap-3 text-sm tabular-nums">
      <div className="flex items-center gap-1.5 text-foreground">
        <Flame className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>{streak.current}</span>
        <span className="text-muted-foreground">day streak</span>
      </div>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        best {streak.longest}
      </span>
    </div>
  )
}
