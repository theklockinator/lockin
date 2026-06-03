import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoldConfirmButton } from '@/components/ui/hold-confirm-button'
import { Input } from '@/components/ui/input'
import { ensureAudioContext, playTimerFinishChord } from '@/lib/timer-chord'
import { cn } from '@/lib/utils'

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function parseSegment(value: string): number | null {
  if (value === '' || !/^\d+$/.test(value)) return null
  return Number(value)
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')

    if (parts.length === 2) {
      const mins = parseSegment(parts[0])
      const secs = parseSegment(parts[1])
      if (mins === null || secs === null || secs >= 60) return null
      return mins * 60 + secs
    }

    if (parts.length === 3) {
      const hours = parseSegment(parts[0])
      const mins = parseSegment(parts[1])
      const secs = parseSegment(parts[2])
      if (
        hours === null ||
        mins === null ||
        secs === null ||
        mins >= 60 ||
        secs >= 60
      ) {
        return null
      }
      return hours * 3600 + mins * 60 + secs
    }

    return null
  }

  const mins = Number(trimmed)
  if (!Number.isFinite(mins) || mins < 0) return null
  return Math.floor(mins) * 60
}

export function TimerWidget() {
  const [minimized, setMinimized] = useState(false)
  const [timeInput, setTimeInput] = useState('45:00')
  const [remainingSeconds, setRemainingSeconds] = useState(45 * 60)
  const [baseSeconds, setBaseSeconds] = useState(45 * 60)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [activeSession, setActiveSession] = useState(false)
  const [inputError, setInputError] = useState(false)
  const endAtRef = useRef<number | null>(null)
  const finishedSoundRef = useRef(false)

  const isPaused = !running && !finished && activeSession
  const isIdle = !running && !finished && !activeSession
  const timerFinishedClass =
    'border-urgency-today/50 text-urgency-today'

  const commitTimeInput = (value: string = timeInput): boolean => {
    const parsed = parseTimeInput(value)
    if (parsed === null || parsed <= 0) {
      setInputError(true)
      setTimeInput(formatTime(remainingSeconds))
      return false
    }
    setInputError(false)
    setTimeInput(formatTime(parsed))
    setRemainingSeconds(parsed)
    setBaseSeconds(parsed)
    setFinished(false)
    finishedSoundRef.current = false
    setActiveSession(false)
    return true
  }

  useEffect(() => {
    if (!running) return

    const tick = () => {
      if (endAtRef.current === null) return
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setRemainingSeconds(left)
      setTimeInput(formatTime(left))
      if (left <= 0) {
        setRunning(false)
        setFinished(true)
        endAtRef.current = null
        if (!finishedSoundRef.current) {
          finishedSoundRef.current = true
          void playTimerFinishChord()
        }
      }
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [running])

  const start = () => {
    ensureAudioContext()
    if (!commitTimeInput()) return
    const parsed = parseTimeInput(timeInput)
    if (parsed === null || parsed <= 0) return
    const startFrom = finished ? parsed : remainingSeconds
    setRemainingSeconds(startFrom)
    setTimeInput(formatTime(startFrom))
    setBaseSeconds(parsed)
    endAtRef.current = Date.now() + startFrom * 1000
    setFinished(false)
    finishedSoundRef.current = false
    setActiveSession(true)
    setRunning(true)
  }

  const pause = () => {
    setRunning(false)
    endAtRef.current = null
    setTimeInput(formatTime(remainingSeconds))
  }

  const reset = () => {
    setRunning(false)
    endAtRef.current = null
    setFinished(false)
    setActiveSession(false)
    finishedSoundRef.current = false
    setRemainingSeconds(baseSeconds)
    setTimeInput(formatTime(baseSeconds))
    setInputError(false)
  }

  const handleTimeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !running) {
      commitTimeInput()
    }
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm tabular-nums shadow-lg transition-colors hover:bg-muted',
          finished && timerFinishedClass,
          running && !finished && 'border-ring',
        )}
        aria-label={
          isPaused ? 'Expand timer (paused)' : 'Expand timer'
        }
      >
        {isPaused && (
          <Pause
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(!isIdle && !finished && 'tabular-nums')}
        >
          {finished ? 'Done' : isIdle ? 'Timer' : formatTime(remainingSeconds)}
        </span>
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <aside
      className={cn(
        'fixed bottom-4 right-4 z-50 w-64 rounded-lg border border-border bg-surface p-4 shadow-lg',
        finished && timerFinishedClass,
      )}
      aria-label="Exam timer"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Timer</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setMinimized(true)}
          aria-label="Minimize timer"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <Input
        value={running ? formatTime(remainingSeconds) : timeInput}
        readOnly={running}
        disabled={running}
        onChange={(e) => {
          setInputError(false)
          setTimeInput(e.target.value)
        }}
        onBlur={() => {
          if (!running) commitTimeInput()
        }}
        onKeyDown={handleTimeKeyDown}
        placeholder="HH:MM:SS"
        inputMode="numeric"
        className={cn(
          'mb-1 h-12 border-0 bg-transparent text-center text-3xl font-medium tabular-nums shadow-none',
          'focus-visible:ring-0 focus-visible:ring-offset-0',
          running && 'cursor-default opacity-100 disabled:opacity-100',
          finished && !running && 'text-urgency-today',
          inputError && 'text-red-400',
        )}
        aria-label="Timer duration"
      />
      {!running && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          HH:MM:SS or MM:SS · editable when paused
        </p>
      )}
      {running && <div className="mb-3" />}

      <div className="flex gap-2">
        {!running ? (
          <Button type="button" className="flex-1" onClick={start}>
            <Play className="h-4 w-4" />
            Start
          </Button>
        ) : (
          <Button type="button" variant="secondary" className="flex-1" onClick={pause}>
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}
        <HoldConfirmButton
          onConfirm={reset}
          className="h-9 w-9 shrink-0"
          title="Hold to reset"
          ariaLabel="Hold to reset timer"
        >
          <RotateCcw className="h-4 w-4" />
        </HoldConfirmButton>
      </div>
    </aside>
  )
}
