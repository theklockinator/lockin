export type ThemeId =
  | 'dark'
  | 'light'
  | 'crimson'
  | 'sunrise'
  | 'mist'
  | 'emerald'

export type ThemeMeta = {
  id: ThemeId
  label: string
  colorScheme: 'dark' | 'light'
}

export const THEMES: ThemeMeta[] = [
  { id: 'dark', label: 'dark', colorScheme: 'dark' },
  { id: 'light', label: 'light', colorScheme: 'light' },
  { id: 'crimson', label: 'crimson', colorScheme: 'dark' },
  { id: 'sunrise', label: 'sunrise', colorScheme: 'light' },
  { id: 'mist', label: 'mist', colorScheme: 'dark' },
  { id: 'emerald', label: 'emerald', colorScheme: 'dark' },
]

const STORAGE_KEY = 'lockin-theme'

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function getStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'amethyst') return 'emerald'
    if (raw && isThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function applyTheme(id: ThemeId): void {
  const meta = THEMES.find((t) => t.id === id) ?? THEMES[0]
  document.documentElement.dataset.theme = meta.id
  document.documentElement.style.colorScheme = meta.colorScheme
  try {
    localStorage.setItem(STORAGE_KEY, meta.id)
  } catch {
    /* ignore */
  }
}

export function initTheme(): ThemeId {
  const id = getStoredTheme()
  applyTheme(id)
  return id
}
