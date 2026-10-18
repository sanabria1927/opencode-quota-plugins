// Uso de Codex (cuota ChatGPT) por sondeo ligero.
// La cuota viene en los headers de una petición mínima a
// https://chatgpt.com/backend-api/codex/responses.

import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { storedCredentials } from "./credentials.js"

export const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses"
export const CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models?client_version=1.0.0"
export const CODEX_TIMEOUT_MS = 15_000
export const DEFAULT_CODEX_AUTH_FILE = join(homedir(), ".local", "share", "opencode", "auth.json")
export const DEFAULT_CODEX_CLI_AUTH_FILE = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json")

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Resuelve las credenciales de Codex sin exponerlas. Orden de precedencia:
 * 1. OPENCODE_CODEX_ACCESS_TOKEN (+ OPENCODE_CODEX_ACCOUNT_ID opcional).
 * 2. Store V2 de OpenCode: credencial `openai` tipo OAuth (la activa primero).
 *    Es la que OpenCode mantiene fresca; reemplaza al auth.json legado.
 * 3. auth.json del CLI de Codex (~/.codex/auth.json -> tokens.access_token /
 *    tokens.account_id).
 * 4. auth.json de OpenCode -> openai.access / openai.accountId (legado).
 */
export async function resolveCodexAuth(context) {
  const fromEnv = process.env.OPENCODE_CODEX_ACCESS_TOKEN
  if (isNonEmptyString(fromEnv)) {
    return { access: fromEnv.trim(), accountId: process.env.OPENCODE_CODEX_ACCOUNT_ID?.trim() || "" }
  }

  // Store V2 (preferido): la credencial OAuth activa de la integración openai.
  try {
    const openai = (await storedCredentials(context, "openai")).filter(
      (entry) => entry?.value?.type === "oauth" && isNonEmptyString(entry.value.access),
    )
    const active = openai.find((entry) => entry.active === true) ?? openai[0]
    if (active) {
      const meta = active.value.metadata ?? {}
      const accountId = meta.accountID ?? meta.accountId ?? meta["chatgpt-account-id"] ?? ""
      return { access: active.value.access.trim(), accountId: String(accountId).trim() }
    }
  } catch {
    // Sin cliente o store: se sigue con archivos.
  }

  const codexFile = process.env.OPENCODE_CODEX_CLI_AUTH_FILE || DEFAULT_CODEX_CLI_AUTH_FILE
  try {
    const parsed = JSON.parse(readFileSync(codexFile, "utf8"))
    const access = parsed?.tokens?.access_token
    if (isNonEmptyString(access)) return { access: access.trim(), accountId: parsed?.tokens?.account_id || "" }
  } catch {
    // Sin CLI de Codex o JSON inválido: se sigue al auth.json de OpenCode.
  }
  const authFile = process.env.OPENCODE_CODEX_AUTH_FILE || process.env.OPENCODE_AUTH_PATH || DEFAULT_CODEX_AUTH_FILE
  try {
    const parsed = JSON.parse(readFileSync(authFile, "utf8"))
    const access = parsed?.openai?.access
    if (isNonEmptyString(access)) return { access: access.trim(), accountId: parsed?.openai?.accountId || "" }
  } catch {
    // Sin archivo o JSON inválido: se reporta como falta de credencial.
  }
  return undefined
}

const header = (headers, name) => {
  try {
    const value = headers?.get?.(name)
    return isNonEmptyString(value) ? value.trim() : undefined
  } catch {
    return undefined
  }
}

const percent = (raw) => {
  const parsed = num(raw)
  if (parsed === undefined) return undefined
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

// "3661" segundos -> "1h 1m"; undefined si no se puede interpretar.
export function durationText(raw) {
  const total = num(raw)
  if (total === undefined) return undefined
  const seconds = Math.max(0, Math.floor(total))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export function windowLabel(minutes, fallback) {
  if (minutes === undefined || minutes <= 0) return fallback
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

let cachedModel

async function resolveModel(access, accountId, fetchImpl, signal) {
  if (cachedModel) return cachedModel
  const response = await fetchImpl(CODEX_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${access}`,
      accept: "application/json",
      "openai-beta": "responses=experimental",
      originator: "codex_cli_rs",
      "chatgpt-account-id": accountId,
    },
    signal,
  })
  if (!response.ok) throw new Error(`${CODEX_MODELS_URL} -> HTTP ${response.status}`)
  const body = await response.json()
  const slug = body?.models?.map((m) => m?.slug).find(isNonEmptyString)?.trim()
  if (!slug) throw new Error("sin modelos Codex para esta cuenta")
  cachedModel = slug
  return slug
}

/**
 * Sondea la cuota de Codex. Cada sondeo gasta unos pocos tokens: no llamar
 * más de una vez cada varios minutos.
 */
export async function probeCodex(auth, fetchImpl = fetch, timeoutMs = CODEX_TIMEOUT_MS) {
  const signal = AbortSignal.timeout(timeoutMs)
  const model = await resolveModel(auth.access, auth.accountId, fetchImpl, signal)
  const response = await fetchImpl(CODEX_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.access}`,
      "content-type": "application/json",
      accept: "text/event-stream",
      "openai-beta": "responses=experimental",
      originator: "codex_cli_rs",
      "chatgpt-account-id": auth.accountId,
    },
    body: JSON.stringify({
      model,
      instructions: "You are a coding assistant.",
      input: [{ role: "user", content: [{ type: "input_text", text: "reply ok" }] }],
      store: false,
      stream: true,
    }),
    signal,
  })
  if (!response.ok) throw new Error(`${CODEX_RESPONSES_URL} -> HTTP ${response.status}`)
  await response.text()
  const pick = (prefix) => ({
    percent: percent(header(response.headers, `${prefix}-used-percent`)),
    reset: durationText(header(response.headers, `${prefix}-reset-after-seconds`)),
    windowMinutes: num(header(response.headers, `${prefix}-window-minutes`)),
  })
  const plan = header(response.headers, "x-codex-plan-type")
  return {
    plan: plan || "Codex",
    primary: pick("x-codex-primary"),
    secondary: pick("x-codex-secondary"),
  }
}
