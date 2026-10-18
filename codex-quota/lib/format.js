// Formato de barras, montos y tiempos para el sidebar (sin dependencias).

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Barra de progreso de `width` celdas. */
export function bar(percent, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return "█".repeat(filled) + "░".repeat(width - filled)
}

export const percentLabel = (value) => `${Math.round(value)}%`

export function truncate(value, width) {
  const text = String(value)
  if (text.length <= width) return text
  if (width <= 1) return text.slice(0, width)
  return `${text.slice(0, width - 1)}…`
}
