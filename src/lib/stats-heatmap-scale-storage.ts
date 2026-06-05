const STORAGE_KEY = 'lockin-stats-heatmap-scale'

export type HeatmapScale = { min: number; max: number }

export function loadHeatmapScale(): HeatmapScale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HeatmapScale
    if (
      typeof parsed.min !== 'number' ||
      typeof parsed.max !== 'number' ||
      !Number.isFinite(parsed.min) ||
      !Number.isFinite(parsed.max)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveHeatmapScale(scale: HeatmapScale): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scale))
  } catch {
    /* ignore quota */
  }
}
