import { cn } from '@/lib/utils'

export type AppTab = 'track' | 'notes' | 'exam' | 'stats'

export function TabNav({
  active,
  onChange,
}: {
  active: AppTab
  onChange: (tab: AppTab) => void
}) {
  const tabs: { id: AppTab; label: string }[] = [
    { id: 'track', label: 'Track' },
    { id: 'notes', label: 'Notes' },
    { id: 'exam', label: 'Exam' },
    { id: 'stats', label: 'Stats' },
  ]

  return (
    <nav
      className="flex gap-1 border-b border-border"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'border-b-2 px-4 py-2 text-sm transition-colors -mb-px',
            active === tab.id
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
