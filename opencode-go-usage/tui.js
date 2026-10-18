// Plugin TUI de OpenCode: muestra el uso de OpenCode Go en el sidebar.
// Contrato V2: exporta { id, setup } y usa el contexto (ui.slot, keymap, ui.toast).
// Sin JSX: usa createElement/insert/setProp de @opentui/solid.

import { createElement, insert, setProp } from "@opentui/solid"
import { createSignal, onCleanup } from "solid-js"
import { money, monthLine, truncate, windowLine } from "./lib/format.js"
import { activateCredential } from "./lib/credentials.js"
import { loadAllGoUsages, resolveGoAccounts } from "./lib/usage.js"

const PLUGIN_ID = "opencode-go-usage"
const REFRESH_MS = 60_000
const SIDEBAR_WIDTH = 30

function element(tag, props, children = []) {
  const node = createElement(tag)
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue
    try {
      setProp(node, key, value)
    } catch {
      // Propiedad no soportada por el elemento: se ignora.
    }
  }
  for (const child of children) {
    if (child === undefined || child === null || child === false) continue
    insert(node, child)
  }
  return node
}

const box = (props, children) => element("box", props, children)
const text = (props, children) => element("text", props, children)

// Marcador de la cuenta activa. Sin `id` (env/archivos) no hay activación nativa.
function marker(account) {
  if (!account?.id) return ""
  return account.active ? "● " : "○ "
}

function accountLines(account) {
  const suffix = account.label ? ` ${account.label}` : ""
  const head = marker(account)
  if (account.error) return [`${head}OpenCode · Go${suffix}`, truncate(`error: ${account.error}`, SIDEBAR_WIDTH)]
  const usage = account.usage
  if (!usage) return [`${head}OpenCode · Go${suffix}`, "uso no disponible"]
  return [
    `${head}OpenCode · ${usage.plan}${suffix}`,
    truncate(monthLine(usage.monthly), SIDEBAR_WIDTH),
    truncate(`${money(usage.monthly.used)} de ${money(usage.monthly.cap)}`, SIDEBAR_WIDTH),
    truncate(windowLine("5h", usage.fiveHour), SIDEBAR_WIDTH),
    truncate(windowLine("Sem", usage.weekly), SIDEBAR_WIDTH),
  ]
}

export function linesFor({ accounts, usage, error, loading }) {
  const list = activeAccounts(accounts ?? (usage ? [{ label: "", usage }] : []))
  if (error && list.length === 0) return ["OpenCode · Go", truncate(`error: ${error}`, SIDEBAR_WIDTH)]
  if (list.length === 0) return ["OpenCode · Go", loading ? "cargando…" : "uso no disponible"]
  return list.flatMap((account) => accountLines(account))
}

// Solo mostramos la cuota de la cuenta en uso. Si hay una o más marcadas como
// activas, se usan esas; si no hay ninguna (p. ej. cuentas de env/archivos, sin
// concepto de "activa"), se muestran todas como antes.
export function activeAccounts(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return []
  const active = accounts.filter((account) => account?.active === true)
  return active.length > 0 ? active : accounts
}

export function usageSummary(accountsOrUsage) {
  const list = Array.isArray(accountsOrUsage) ? accountsOrUsage : accountsOrUsage ? [{ label: "", usage: accountsOrUsage }] : []
  if (list.length === 0) return "sin datos"
  return list
    .map((account) => {
      const { label, usage, error } = account
      const head = account?.id ? (account.active ? "● " : "○ ") : ""
      const prefix = `${head}${label ? `${label}: ` : ""}`
      if (error) return `${prefix}Error: ${error}`
      if (!usage) return `${prefix}sin datos`
      return `${prefix}${monthLine(usage.monthly)} (${money(usage.monthly.used)} de ${money(usage.monthly.cap)}) | ${windowLine("5h", usage.fiveHour)} | ${windowLine("Sem", usage.weekly)}`
    })
    .join("\n")
}

export function renderSidebar(state) {
  return box({ width: "100%", flexDirection: "column" }, linesFor(state).map((line) => text(null, [line])))
}

// El host V2 expone ui.slot({ append, render }); generaciones previas usaban
// ui.slot(name, render) y registran nada con la forma nueva. Se ramifica por aridad.
function registerSlot(context, name, render) {
  const slot = context.ui?.slot
  if (typeof slot !== "function") throw new Error("sin ui.slot")
  const dispose = slot.length <= 1 ? context.ui.slot({ append: name, render }) : context.ui.slot(name, render)
  return typeof dispose === "function" ? dispose : () => {}
}

export default {
  id: PLUGIN_ID,
  setup: async (context) => {
    const [getAccounts, setAccounts] = createSignal([])
    const [getError, setError] = createSignal(undefined)
    const [getLoading, setLoading] = createSignal(true)
    const cleanups = []
    let disposed = false
    let timer
    let debounce

    const onDispose = (fn) => {
      if (typeof fn === "function") cleanups.push(fn)
    }

    const refresh = async () => {
      const keys = await resolveGoAccounts(context)
      if (keys.length === 0) {
        if (disposed) return
        if (getAccounts().length === 0) setError("falta API key")
        setLoading(false)
        return
      }
      try {
        const results = await loadAllGoUsages(keys)
        if (disposed) return
        setAccounts(results)
        setError(results.every((r) => r.error && !r.usage) ? (results[0]?.error ?? "error de cuota") : undefined)
      } catch (err) {
        if (disposed) return
        if (getAccounts().length === 0) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    const showToast = async () => {
      await refresh()
      const accounts = activeAccounts(getAccounts())
      const err = getError()
      const active = accounts[0]
      context.ui?.toast?.show?.({
        title: active?.label ? `OpenCode Go · ${active.label}` : "OpenCode Go",
        message: accounts.length > 0 ? usageSummary(accounts) : err ? `Error: ${err}` : "sin datos",
        variant: err && accounts.length === 0 ? "error" : "info",
        duration: 10_000,
      })
    }

    // Activa una cuenta guardada (mecanismo nativo de OpenCode: también cambia
    // qué cuenta usa OpenCode para sus peticiones).
    const activate = async (credentialID) => {
      if (!credentialID) return
      try {
        await activateCredential(context, credentialID)
        await refresh()
        const active = getAccounts().find((a) => a.active)
        context.ui?.toast?.show?.({
          title: "OpenCode Go",
          message: active ? `Cuenta activa: ${active.label || "OK"}` : "Cuenta activada",
          variant: "success",
          duration: 5000,
        })
      } catch (err) {
        context.ui?.toast?.show?.({
          title: "OpenCode Go",
          message: `No se pudo activar: ${err instanceof Error ? err.message : String(err)}`,
          variant: "error",
          duration: 8000,
        })
      }
    }

    // Menú para elegir la cuenta activa entre las credenciales guardadas.
    const pickAccount = async () => {
      await refresh()
      const activatable = getAccounts().filter((a) => a.id)
      if (activatable.length < 2) {
        context.ui?.toast?.show?.({
          title: "OpenCode Go",
          message:
            activatable.length === 0
              ? "No hay cuentas guardadas activables."
              : "Solo hay una cuenta guardada; no hay nada que cambiar.",
          variant: "warning",
          duration: 8000,
        })
        return
      }
      const select = context.ui?.dialog?.select
      if (typeof select !== "function") {
        context.ui?.toast?.show?.({ title: "OpenCode Go", message: "Este TUI no expone dialog.select.", variant: "error" })
        return
      }
      const currentId = activatable.find((a) => a.active)?.id
      const choice = await select({
        title: "Cuenta activa de OpenCode Go",
        current: currentId,
        options: activatable.map((a) => ({
          title: `${a.label || a.id}${a.active ? " (activa)" : ""}`,
          value: a.id,
          description: a.active ? "En uso ahora por OpenCode" : "Activar esta cuenta",
        })),
      })
      if (choice === undefined || choice === null || choice === currentId) return
      await activate(choice)
    }

    await refresh()
    timer = setInterval(() => {
      void refresh()
    }, REFRESH_MS)
    if (timer && typeof timer.unref === "function") timer.unref()

    try {
      const stopEvent = context.data?.on?.("session.execution.succeeded", () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => {
          void refresh()
        }, 3000)
      })
      onDispose(stopEvent)
    } catch {
      // Sin bus de eventos: queda el refresco periódico.
    }

    // Cuando OpenCode cambia/actualiza una credencial (p. ej. al activar otra
    // cuenta), refrescamos para reordenar y repintar los marcadores.
    for (const type of ["credential.switched", "credential.updated"]) {
      try {
        onDispose(context.data?.on?.(type, () => void refresh()))
      } catch {
        // Tipo de evento desconocido en esta versión: se ignora.
      }
    }

    try {
      onDispose(registerSlot(context, "sidebar.content", () => renderSidebar({ accounts: getAccounts(), error: getError(), loading: getLoading() })))
    } catch {
      // El sidebar puede no estar disponible; el comando sigue sirviendo.
    }

    // keymap.layer debe invocarse desde un scope de componente Solid, por eso
    // vive dentro de un componente montado en el slot `app` (no pinta nada).
    try {
      onDispose(
        registerSlot(context, "app", () => {
          let offLayer
          try {
            offLayer = context.keymap?.layer?.(() => ({
              mode: "global",
              commands: [
                {
                  id: "go.usage",
                  title: "OpenCode Go usage",
                  group: "OpenCode Go",
                  palette: true,
                  slash: { name: "go-usage" },
                  run: () => {
                    void showToast()
                  },
                },
                {
                  id: "go.accounts",
                  title: "OpenCode Go: elegir cuenta activa",
                  group: "OpenCode Go",
                  palette: true,
                  slash: { name: "go-accounts" },
                  run: () => {
                    void pickAccount()
                  },
                },
                // Una entrada de paleta por cada cuenta guardada inactiva.
                ...getAccounts()
                  .filter((account) => account.id && !account.active)
                  .map((account) => ({
                    id: `go.activate.${account.id}`,
                    title: `OpenCode Go: activar ${account.label || account.id}`,
                    group: "OpenCode Go",
                    palette: true,
                    run: () => {
                      void activate(account.id)
                    },
                  })),
              ],
              bindings: ["go.usage", "go.accounts"],
            }))
          } catch {
            // Sin keymap: el sidebar sigue visible.
          }
          try {
            onCleanup(() => {
              if (typeof offLayer === "function") offLayer()
            })
          } catch {
            // Fuera de scope Solid (p. ej. pruebas): la limpieza global cubre.
          }
          return null
        }),
      )
    } catch {
      // Sin slot `app`: el sidebar sigue visible.
    }

    return () => {
      disposed = true
      if (timer) clearInterval(timer)
      if (debounce) clearTimeout(debounce)
      for (const fn of cleanups.splice(0)) {
        try {
          fn()
        } catch {
          // La limpieza es mejor esfuerzo.
        }
      }
    }
  },
}
