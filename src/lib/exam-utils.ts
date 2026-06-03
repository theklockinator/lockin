import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Exam, ExamLink } from './exam-types'
import { generateId } from './utils'

export function sortedExams(exams: Exam[]): Exam[] {
  return [...exams].sort((a, b) => {
    const ta = parseISO(a.scheduledAt).getTime()
    const tb = parseISO(b.scheduledAt).getTime()
    if (ta !== tb) return ta - tb
    return a.sortOrder - b.sortOrder
  })
}

export function daysUntilExam(scheduledAt: string, now = new Date()): number {
  const examDate = parseISO(scheduledAt)
  return differenceInCalendarDays(examDate, now)
}

export function formatDaysLeft(
  scheduledAt: string,
  status: Exam['status'],
  now = new Date(),
): string {
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'completed') return 'Done'
  const days = daysUntilExam(scheduledAt, now)
  if (days < 0) return `${Math.abs(days)}d ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

export function daysLeftUrgency(
  scheduledAt: string,
  status: Exam['status'],
): 'cancelled' | 'done' | 'past' | 'today' | 'soon' | 'normal' {
  if (status === 'cancelled') return 'cancelled'
  if (status === 'completed') return 'done'
  const days = daysUntilExam(scheduledAt)
  if (days < 0) return 'past'
  if (days === 0) return 'today'
  if (days <= 7) return 'soon'
  return 'normal'
}

export function formatExamDateTime(scheduledAt: string): string {
  try {
    return format(parseISO(scheduledAt), 'EEE d MMM yyyy, HH:mm')
  } catch {
    return scheduledAt
  }
}

export function toDatetimeLocalValue(isoOrLocal: string): string {
  if (!isoOrLocal) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoOrLocal)) {
    return isoOrLocal.slice(0, 16)
  }
  try {
    return format(parseISO(isoOrLocal), "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

export function parseLinksText(text: string): ExamLink[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|')
      if (pipe >= 0) {
        const label = line.slice(0, pipe).trim()
        const url = line.slice(pipe + 1).trim()
        return { id: generateId(), label: label || url, url }
      }
      return { id: generateId(), label: line, url: line }
    })
}

export function linksToText(links: ExamLink[]): string {
  return links
    .map((l) => (l.label && l.label !== l.url ? `${l.label} | ${l.url}` : l.url))
    .join('\n')
}

export function nextUpcomingExam(exams: Exam[]): Exam | null {
  const now = Date.now()
  const upcoming = sortedExams(exams).filter(
    (e) =>
      e.status === 'upcoming' && parseISO(e.scheduledAt).getTime() >= now - 86400000,
  )
  return upcoming[0] ?? null
}
