function isMod(e: { metaKey: boolean; ctrlKey: boolean }) {
  return e.metaKey || e.ctrlKey
}

export function formatShortcut(
  e: KeyboardEvent,
  onBold: () => void,
  onItalic: () => void,
  onUnderline: () => void,
): boolean {
  if (!isMod(e)) return false
  const k = e.key.toLowerCase()
  if (k === 'b') {
    e.preventDefault()
    onBold()
    return true
  }
  if (k === 'i') {
    e.preventDefault()
    onItalic()
    return true
  }
  if (k === 'u') {
    e.preventDefault()
    onUnderline()
    return true
  }
  return false
}
