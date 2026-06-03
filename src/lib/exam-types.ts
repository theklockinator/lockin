export type ExamStatus = 'upcoming' | 'completed' | 'cancelled'

export type ExamLink = {
  id: string
  label: string
  url: string
}

export type Exam = {
  id: string
  name: string
  durationMinutes: number
  maxMarks: number
  /** Set when status is completed; null if not recorded yet */
  marksAchieved: number | null
  /** Local datetime for input[type=datetime-local], e.g. 2026-06-15T14:00 */
  scheduledAt: string
  location: string
  links: ExamLink[]
  subject: string
  paperCode: string
  seatNumber: string
  materials: string
  status: ExamStatus
  targetGrade: string
  notes: string
  sortOrder: number
  createdAt: string
}

export type ExamInput = {
  name: string
  durationMinutes: number
  maxMarks: number
  marksAchieved?: number | null
  scheduledAt: string
  location: string
  links: ExamLink[]
  subject: string
  paperCode: string
  seatNumber: string
  materials: string
  status: ExamStatus
  targetGrade: string
  notes: string
}

export const MAX_EXAMS = 30

export const EXAM_STATUSES: { value: ExamStatus; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
