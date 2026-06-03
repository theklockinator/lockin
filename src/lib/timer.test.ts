import { describe, expect, it } from 'vitest'

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

describe('parseTimeInput', () => {
  it('parses MM:SS', () => {
    expect(parseTimeInput('45:30')).toBe(45 * 60 + 30)
  })

  it('parses HH:MM:SS', () => {
    expect(parseTimeInput('1:30:00')).toBe(5400)
    expect(parseTimeInput('01:05:09')).toBe(3909)
  })

  it('parses plain minutes', () => {
    expect(parseTimeInput('45')).toBe(2700)
  })

  it('rejects invalid segments', () => {
    expect(parseTimeInput('1:60:00')).toBeNull()
    expect(parseTimeInput('1:05:99')).toBeNull()
  })
})
