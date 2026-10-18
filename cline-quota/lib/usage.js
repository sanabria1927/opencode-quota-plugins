// Uso de ClinePass (cuota 5h / semanal / mensual).
//
// Endpoint usado por el dashboard de Cline:
//   GET https://api.cline.bot/api/v1/users/me/plan/usage-limits
// Devuelve { success, data: { limits: [{ type, percentUsed, resetsAt }] } }
// con type en { five_hour, weekly, monthly }.
//
// El plan se lee de /api/v1/users/me/plan (displayName + periodo del ciclo).

import { storedCredentials } from "./credentials.js"

export const CLINE_API_BASE = "https://api.cline.bot"
export const CLINE_LIMITS_PATH = "/api/v1/users/me/plan/usage-limits"
export const CLINE_PLAN_PATH = "/api/v1/users/me/plan"

// Etiquetas de las ventanas, por `type` del API.
const WINDOW_LABELS = { five_hour: "5h", weekly: "Sem", monthly: "Mes" }

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

/**
 * Resuelve la API key de ClinePass sin exponerla. Orden de precedencia:
 * 1. `CLINE_API_KEY` en el entorno del proceso de OpenCode.
 * 2. Store V2: credencial de la integración `cline-pass` (activa primero).
 */
export async function resolveClineKey(context) {
  const fromEnv = process.env.CLINE_API_KEY
  if (isNonEmptyString(fromEnv)) return fromEnv.trim()

  const stored = await storedCredentials(context, "cline-pass")
  const active = stored.find((entry) => entry?.value?.type === "key" && isNonEmptyString(entry.value.key))
  return active ? active.value.key.trim() : undefined
}

async function getJson(path, apiKey, signal) {
  const response = await fetch(`${CLINE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal,
  })
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`)
  return response.json()
}

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toEpochMs = (value) => {
  if (typeof value === "number") return num(value)
  if (isNonEmptyString(value)) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeWindow(raw) {
  if (!raw) return { percent: 0, resetAt: undefined, known: false }
  const percent = Math.max(0, Math.min(100, num(raw.percentUsed) ?? 0))
  return { percent, resetAt: toEpochMs(raw.resetsAt), known: true }
}

function planName(planResponse) {
  const plan = planResponse?.data?.plan
  const label = plan?.displayName ?? plan?.name
  if (!isNonEmptyString(label)) return "ClinePass"
  // "Cline Pass (Monthly)[Internal]" -> "Cline Pass (Monthly)"
  return label.replace(/\s*\[[^\]]*\]\s*$/, "").trim()
}

/** Consulta la cuota de ClinePass. */
export async function loadClineUsage(apiKey, signal) {
  const [limitsResponse, planResponse] = await Promise.all([
    getJson(CLINE_LIMITS_PATH, apiKey, signal),
    getJson(CLINE_PLAN_PATH, apiKey, signal).catch(() => undefined),
  ])

  const limits = Array.isArray(limitsResponse?.data?.limits) ? limitsResponse.data.limits : []
  const byType = (type) => normalizeWindow(limits.find((item) => item?.type === type))

  const plan = planName(planResponse)
  return {
    plan,
    // El plan ya incluye "Cline Pass"; evitamos repetirlo en el encabezado.
    shortPlan: plan.replace(/^Cline\s*Pass\s*/i, "").trim(),
    fiveHour: byType("five_hour"),
    weekly: byType("weekly"),
    monthly: byType("monthly"),
  }
}

export { WINDOW_LABELS }
