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

export const money = (value) => `$${(num(value) ?? 0).toFixed(2)}`

export function truncate(value, width) {
  const text = String(value)
  if (text.length <= width) return text
  if (width <= 1) return text.slice(0, width)
  return `${text.slice(0, width - 1)}…`
}

/** Una línea de ventana: "5h ███░░░ 32% · 2h 15m". */
export function windowLine(label, window) {
  return `${label} ${bar(window.percent)} ${percentLabel(window.percent)} · ${countdown(window.resetAt)}`
}

/** Una línea mensual: "Mes ███░░░ 36% · 21d 5h". Sin reinicio: "Mes ███░░░ 36%". */
export function monthLine(month) {
  const reset = countdown(month?.resetAt)
  const suffix = reset ? ` · ${reset}` : ""
  return `Mes ${bar(month.percent)} ${percentLabel(month.percent)}${suffix}`
}
