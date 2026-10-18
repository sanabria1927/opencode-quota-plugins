// Uso de OpenCode Go (https://opencode.ai/zen/go/v1/usage).
// Límites documentados en https://opencode.ai/v2/docs/console/go/.

import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { storedCredentials } from "./credentials.js"

export const GO_API_BASE = "https://opencode.ai"
export const GO_USAGE_PATH = "/zen/go/v1/usage"
export const DEFAULT_OPENCODE_AUTH_FILE = join(homedir(), ".local", "share", "opencode", "auth.json")

// Límites de OpenCode Go en USD (ver docs de console/go).
export const GO_LIMITS = { fiveHour: 12, weekly: 30, monthly: 60 }

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

const splitList = (value) => {
  if (!isNonEmptyString(value)) return []
  return value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function readKeyFromAuthFile(authFile) {
  try {
    const parsed = JSON.parse(readFileSync(authFile, "utf8"))
    const key = parsed?.["opencode-go"]?.key
    if (isNonEmptyString(key)) return key.trim()
  } catch {
    // Sin archivo o JSON inválido: se ignora este archivo.
  }
  return undefined
}

function defaultLabel(index) {
  if (index < 26) return String.fromCharCode(65 + index)
  return String(index + 1)
}

// "OpenCode Go 2" -> "2" (el plan "Go" ya lo pinta el sidebar).
function shortLabel(label, plan = "Go") {
  let text = String(label ?? "").trim()
  if (!text) return ""
  text = text.replace(/^OpenCode\s+/i, "")
  if (plan && text.toLowerCase().startsWith(plan.toLowerCase())) text = text.slice(plan.length).trim()
  return text.slice(0, 12)
}

function resolveEnvLabels(count) {
  const list = splitList(process.env.OPENCODE_GO_LABELS)
  const single = [process.env.OPENCODE_GO_LABEL, process.env.OPENCODE_GO_LABEL_2]
  return Array.from({ length: count }, (_, i) => {
    if (list[i]) return list[i].slice(0, 12)
    if (isNonEmptyString(single[i])) return single[i].trim().slice(0, 12)
    return defaultLabel(i)
  })
}

function hasExplicitEnvLabels() {
  const list = splitList(process.env.OPENCODE_GO_LABELS)
  return list.length > 0 || isNonEmptyString(process.env.OPENCODE_GO_LABEL) || isNonEmptyString(process.env.OPENCODE_GO_LABEL_2)
}

function dedupe(accounts) {
  const out = []
  for (const account of accounts) {
    const key = typeof account?.key === "string" ? account.key.trim() : ""
    if (!key) continue
    if (out.some((entry) => entry.key === key)) continue
    out.push({
      label: typeof account?.label === "string" ? account.label.trim() : "",
      key,
      id: typeof account?.id === "string" ? account.id : undefined,
      active: account?.active === true,
    })
  }
  return out
}

function withLabels(accounts, explicit) {
  if (accounts.length === 0) return []
  if (accounts.length === 1 && !explicit) return [{ ...accounts[0], label: "" }]
  return accounts.map((account, i) => ({
    ...account,
    label: isNonEmptyString(account.label) ? account.label : defaultLabel(i),
  }))
}

/**
 * Resuelve las cuentas de OpenCode Go sin exponer las keys. Orden de precedencia:
 * 1. Env: `OPENCODE_GO_API_KEYS` o `OPENCODE_GO_API_KEY` + `OPENCODE_GO_API_KEY_2`.
 * 2. Store V2: todas las credenciales de la integración `opencode-go`
 *    (activas primero). Es la fuente que usa OpenCode V2; incluye las dos cuentas.
 * 3. Archivos legados: `OPENCODE_GO_AUTH_FILES` / `OPENCODE_GO_AUTH_FILE(_2)` o
 *    `~/.local/share/opencode/auth.json` -> `opencode-go.key`.
 *
 * Devuelve `[{ label, key }]` (label "" cuando hay una sola cuenta).
 */
export async function resolveGoAccounts(context) {
  // 1. Variables de entorno (override explícito).
  const envList = splitList(process.env.OPENCODE_GO_API_KEYS)
  const envAccounts = envList.length > 0
    ? envList.map((key) => ({ key }))
    : [{ key: process.env.OPENCODE_GO_API_KEY }, { key: process.env.OPENCODE_GO_API_KEY_2 }]
        .filter((account) => isNonEmptyString(account.key))
        .map((account) => ({ key: account.key }))
  if (envAccounts.length > 0) {
    const labels = resolveEnvLabels(envAccounts.length)
    const accounts = dedupe(envAccounts.map((account, i) => ({ label: labels[i], key: account.key })))
    return withLabels(accounts, hasExplicitEnvLabels())
  }

  // 2. Store V2 de OpenCode (multi-cuenta, activa primero).
  const stored = await storedCredentials(context, "opencode-go")
  const storedAccounts = dedupe(
    stored
      .filter((entry) => entry?.value?.type === "key" && isNonEmptyString(entry.value.key))
      .map((entry) => ({
        label: shortLabel(entry.label),
        key: entry.value.key,
        id: typeof entry.id === "string" ? entry.id : undefined,
        active: entry.active === true,
      })),
  )
  if (storedAccounts.length > 0) return withLabels(storedAccounts, false)

  // 3. Archivos legados.
  const filesList = splitList(process.env.OPENCODE_GO_AUTH_FILES)
  const fallbackFiles = filesList.length > 0
    ? filesList
    : [
        process.env.OPENCODE_GO_AUTH_FILE || DEFAULT_OPENCODE_AUTH_FILE,
        ...(isNonEmptyString(process.env.OPENCODE_GO_AUTH_FILE_2) ? [process.env.OPENCODE_GO_AUTH_FILE_2.trim()] : []),
      ]
  const fileAccounts = dedupe(fallbackFiles.map((file) => ({ key: readKeyFromAuthFile(file) })))
  return withLabels(fileAccounts, false)
}

/** Compatibilidad: primera cuenta (label "" si hay una sola). */
export async function resolveGoKey(context) {
  const keys = await resolveGoAccounts(context)
  return keys[0]?.key
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

function normalizeGoWindow(raw, cap) {
  const percent = Math.max(0, Math.min(100, num(raw?.percent) ?? 0))
  const used = Math.round(((percent / 100) * cap + Number.EPSILON) * 100) / 100
  return {
    used,
    cap,
    resetAt: toEpochMs(raw?.resetsAt ?? raw?.resetAt),
    percent,
    exceeded: raw?.status === "exceeded" || percent >= 100,
  }
}

/** Consulta /zen/go/v1/usage. */
export async function loadGoUsage(apiKey, signal) {
  const response = await fetch(`${GO_API_BASE}${GO_USAGE_PATH}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal,
  })
  if (!response.ok) throw new Error(`${GO_USAGE_PATH} -> HTTP ${response.status}`)
  const body = await response.json()
  const windows = body?.usage ?? {}
  return {
    plan: "Go",
    fiveHour: normalizeGoWindow(windows.rolling, GO_LIMITS.fiveHour),
    weekly: normalizeGoWindow(windows.weekly, GO_LIMITS.weekly),
    monthly: normalizeGoWindow(windows.monthly, GO_LIMITS.monthly),
  }
}

/**
 * Consulta todas las cuentas en paralelo. Nunca lanza: cada cuenta
 * devuelve { id, label, active, usage } o { id, label, active, error }.
 * Acepta strings o { label, key, id, active }.
 */
export async function loadAllGoUsages(entries, signal) {
  const list = (entries ?? []).map((entry, i) =>
    typeof entry === "string"
      ? { label: defaultLabel(i), key: entry }
      : { label: entry?.label ?? defaultLabel(i), key: entry?.key, id: entry?.id, active: entry?.active === true },
  )
  const results = await Promise.all(
    list.map(async ({ label, key, id, active }) => {
      try {
        const usage = await loadGoUsage(key, signal)
        return { label, id, active, usage }
      } catch (err) {
        return { label, id, active, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )
  return results
}
