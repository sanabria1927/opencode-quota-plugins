// Plugin TUI de OpenCode: muestra la cuota de Codex (ChatGPT) en el sidebar.
// Contrato V2: exporta { id, setup } y usa el contexto (ui.slot, keymap, ui.toast).
// Sin JSX: usa createElement/insert/setProp de @opentui/solid.
// Refresca al arrancar, cada 5 min y tras cada ejecución (command/go usan 60 s,
// pero el sondeo de Codex gasta cuota y el backend responde 429 si se abusa).

import { createElement, insert, setProp } from "@opentui/solid"
import { createSignal, onCleanup } from "solid-js"
import { bar, percentLabel, truncate } from "./lib/format.js"
import { probeCodex, resolveCodexAuth, windowLabel } from "./lib/usage.js"

const PLUGIN_ID = "opencode-codex-quota"
// El sondeo de Codex hace un POST real (gasta cuota y el backend limita con
// 429 si se sondea seguido). Intervalo de 5 min, no 60 s como command/go.
const REFRESH_MS = 300_000
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

/** Etiqueta de ventana: semanal (10080 min) se muestra como "Sem". */
export function codexWindowLabel(win, fallback) {
  if (win?.windowMinutes === 10080) return "Sem"
  return windowLabel(win?.windowMinutes, fallback)
}

/** Una línea de cuota: "5h ███░░░ 32% · 2h 15m" (reset ya es texto). */
export function codexLine(label, win) {
  if (win?.percent === undefined) return truncate(`${label} sin datos`, SIDEBAR_WIDTH)
  const reset = win.reset ? ` · ${win.reset}` : ""
  return truncate(`${label} ${bar(win.percent)} ${percentLabel(win.percent)}${reset}`, SIDEBAR_WIDTH)
}

function codexRows(codex) {
  const rows = [`Codex${codex.plan && codex.plan !== "Codex" ? ` · ${codex.plan}` : ""}`]
  if (codex.primary?.percent !== undefined) rows.push(codexLine(codexWindowLabel(codex.primary, "5h"), codex.primary))
  if (codex.secondary?.percent !== undefined) rows.push(codexLine(codexWindowLabel(codex.secondary, "Sem"), codex.secondary))
  return rows
}

/** Error corto y legible para el sidebar (la URL cruda no cabe ni ayuda). */
export function friendlyError(error) {
  const text = error instanceof Error ? error.message : String(error ?? "")
  if (/HTTP 429/.test(text)) return "límite temporal (429) · reintento 5 min"
  if (/HTTP 40[13]/.test(text)) return "sesión expirada · reconecta"
  if (/falta API key/.test(text)) return "falta API key"
  return truncate(`error: ${text}`, SIDEBAR_WIDTH)
}

export function linesFor({ codex, error, loading }) {
  if (error) return ["Codex", friendlyError(error)]
  if (!codex) return ["Codex", loading ? "cargando…" : "usa /codex-quota"]
  const rows = codexRows(codex)
  return rows.length > 1 ? rows : ["Codex", loading ? "cargando…" : "usa /codex-quota"]
}

export function usageSummary(codex) {
  if (!codex) return "sin datos"
  const parts = []
  if (codex.primary?.percent !== undefined) parts.push(codexLine(codexWindowLabel(codex.primary, "5h"), codex.primary))
  if (codex.secondary?.percent !== undefined) parts.push(codexLine(codexWindowLabel(codex.secondary, "Sem"), codex.secondary))
  return parts.length > 0 ? parts.join(" | ") : "sin datos"
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
    const [getCodex, setCodex] = createSignal(null)
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
      const auth = await resolveCodexAuth(context)
      if (!auth) {
        if (disposed) return
        // Solo mostrar error si aún no hay dato bueno en el sidebar.
        if (!getCodex()) setError("falta API key")
        setLoading(false)
        return
      }
      try {
        const result = await probeCodex(auth)
        if (disposed) return
        setCodex(result)
        setError(undefined)
      } catch (err) {
        if (disposed) return
        // Si ya hay un dato bueno, conservarlo y no pisarlo con el error
        // (típico 429 por sondeo seguido). Solo se muestra error sin dato.
        if (!getCodex()) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    const showToast = async () => {
      await refresh()
      const current = getCodex()
      const err = getError()
      const message = err
        ? /HTTP 429/.test(String(err))
          ? "Límite temporal del backend (429). Espera unos minutos y reintenta /codex-quota."
          : /HTTP 40[13]/.test(String(err))
            ? "Sesión Codex expirada (401/403). Ejecuta `codex login` o reconecta con /connect y reintenta /codex-quota."
            : `Error: ${err}`
        : usageSummary(current)
      context.ui?.toast?.show?.({
        title: current?.plan ? `Codex · ${current.plan}` : "Codex",
        message,
        variant: err ? "error" : "info",
        duration: 10_000,
      })
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

    try {
      onDispose(registerSlot(context, "sidebar.content", () => renderSidebar({ codex: getCodex(), error: getError(), loading: getLoading() })))
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
                  id: "codex.quota",
                  title: "Codex quota",
                  group: "Codex",
                  palette: true,
                  slash: { name: "codex-quota" },
                  run: () => {
                    void showToast()
                  },
                },
              ],
              bindings: ["codex.quota"],
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
