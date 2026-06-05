import { describe, expect, it } from 'vitest'
import { formatDecimalInput, parseDecimalInput } from './decimal-input'

describe('decimal-input', () => {
  it('parses dot and comma decimals', () => {
    expect(parseDecimalInput('45.5')).toBe(45.5)
    expect(parseDecimalInput('45,5')).toBe(45.5)
    expect(parseDecimalInput(' 12,75 ')).toBe(12.75)
  })

  it('returns null for invalid input', () => {
    expect(parseDecimalInput('')).toBeNull()
    expect(parseDecimalInput('abc')).toBeNull()
  })

  it('formats with dot separator', () => {
    expect(formatDecimalInput(68.5)).toBe('68.5')
    expect(formatDecimalInput(70)).toBe('70')
  })
})
