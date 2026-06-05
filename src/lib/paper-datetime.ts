import { format, parseISO } from 'date-fns'
import type { PracticePaper } from './types'

export function currentDatetimeLocal(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

export function normalizeCompletedAt(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return currentDatetimeLocal()
  return format(parsed, "yyyy-MM-dd'T'HH:mm")
}

export function paperDate(paper: PracticePaper): string {
  return paper.completedAt.slice(0, 10)
}

export function parsePaperAt(completedAt: string): Date {
  return parseISO(normalizeCompletedAt(completedAt))
}

export function paperAtMs(paper: PracticePaper): number {
  return parsePaperAt(paper.completedAt).getTime()
}

export type LegacyPaper = {
  id: string
  name?: string
  completedAt?: string
  date?: string
  timeMinutes: number
  marks: number
}

export function normalizePaper(paper: LegacyPaper): PracticePaper {
  const completedAt = paper.completedAt
    ? normalizeCompletedAt(paper.completedAt)
    : paper.date
      ? normalizeCompletedAt(paper.date)
      : currentDatetimeLocal()

  return {
    id: paper.id,
    name: paper.name ?? '',
    completedAt,
    timeMinutes: paper.timeMinutes,
    marks: paper.marks,
  }
}

export function toDatetimeLocalValue(completedAt: string): string {
  return normalizeCompletedAt(completedAt)
}

export function formatPaperDateTime(completedAt: string): string {
  const d = parsePaperAt(completedAt)
  return format(d, 'd MMM yyyy · HH:mm')
}
