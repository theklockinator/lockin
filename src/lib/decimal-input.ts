/** Parse user decimal text; accepts comma or dot separator. */
export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '' || trimmed === '.' || trimmed === '-') return null
  const v = Number.parseFloat(trimmed)
  return Number.isFinite(v) ? v : null
}

/** Display with a dot decimal separator (never locale comma). */
export function formatDecimalInput(n: number): string {
  return String(n)
}
