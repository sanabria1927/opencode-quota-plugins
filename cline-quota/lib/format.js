// Formato de barras y tiempos para el sidebar (sin dependencias).

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

/** Cuenta regresiva compacta hasta `resetAt` (epoch ms o ISO). */
export function countdown(resetAt, now = Date.now()) {
  const target = typeof resetAt === "string" ? Date.parse(resetAt) : resetAt
  if (!target || !Number.isFinite(target)) return ""
  const diff = target - now
  if (diff <= 0) return "now"
  const totalMinutes = Math.floor(diff / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function truncate(value, width) {
  const text = String(value)
  if (text.length <= width) return text
  if (width <= 1) return text.slice(0, width)
  return `${text.slice(0, width - 1)}…`
}

/** Una línea de ventana: "5h ███░░░ 32% · 2h 15m". */
export function windowLine(label, window) {
  const reset = countdown(window?.resetAt)
  const suffix = reset ? ` · ${reset}` : ""
  return `${label} ${bar(window?.percent ?? 0)} ${percentLabel(window?.percent ?? 0)}${suffix}`
}

export { num }
