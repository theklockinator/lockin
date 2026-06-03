import type { DrawStroke } from './notes-types'

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: DrawStroke,
  color: string,
  width: number,
) {
  if (stroke.points.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  stroke.points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.stroke()
}

export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: DrawStroke[],
  opts: {
    highlightColor: string
    highlightWidth: number
    width: number
    height: number
  },
) {
  const { highlightColor, highlightWidth, width, height } = opts
  ctx.clearRect(0, 0, width, height)

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue

    if (stroke.highlighted) {
      drawStrokePath(
        ctx,
        stroke,
        highlightColor,
        stroke.width + highlightWidth * 2,
      )
    }

    drawStrokePath(ctx, stroke, stroke.color, stroke.width)
  }
}

export function erasePointsInRadius(
  strokes: DrawStroke[],
  px: number,
  py: number,
  radius: number,
): DrawStroke[] {
  const r2 = radius * radius
  return strokes
    .map((stroke) => ({
      ...stroke,
      points: stroke.points.filter((p) => {
        const dx = p.x - px
        const dy = p.y - py
        return dx * dx + dy * dy > r2
      }),
    }))
    .filter((s) => s.points.length >= 2)
}
