import { useState } from 'react'
import { ExamTab } from '@/components/ExamTab'
import { Header } from '@/components/Header'
import { NotesTab } from '@/components/NotesTab'
import { TabNav, type AppTab } from '@/components/TabNav'
import { ThemeFooter } from '@/components/ThemeFooter'
import { TimerWidget } from '@/components/TimerWidget'
import { TodayPanel } from '@/components/TodayPanel'
import { UnitForm } from '@/components/UnitForm'
import { UnitList } from '@/components/UnitList'
export default function App() {
  const [tab, setTab] = useState<AppTab>('track')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Header />
        <TabNav active={tab} onChange={setTab} />
        <div className="mt-6 space-y-6">
          {tab === 'track' && (
            <>
              <TodayPanel />
              <UnitList />
              <UnitForm />
            </>
          )}
          {tab === 'notes' && <NotesTab />}
          {tab === 'exam' && <ExamTab />}
        </div>
      </main>
      <TimerWidget />
      <ThemeFooter />
    </div>
  )
}
