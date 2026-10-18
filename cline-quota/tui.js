// Plugin TUI de OpenCode: muestra la cuota de ClinePass en el sidebar.
// Contrato V2: exporta { id, setup } y usa el contexto (ui.slot, keymap, ui.toast).
// Sin JSX: usa createElement/insert/setProp de @opentui/solid.

import { createElement, insert, setProp } from "@opentui/solid"
import { createSignal, onCleanup } from "solid-js"
import { percentLabel, truncate, windowLine } from "./lib/format.js"
import { loadClineUsage, resolveClineKey } from "./lib/usage.js"

const PLUGIN_ID = "opencode-cline-quota"
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

export function linesFor({ usage, error, loading }) {
  if (error) return ["ClinePass", truncate(`error: ${error}`, SIDEBAR_WIDTH)]
  if (!usage) return ["ClinePass", loading ? "cargando…" : "uso no disponible"]
  const suffix = usage.shortPlan ? ` · ${usage.shortPlan}` : ""
  return [
    truncate(`ClinePass${suffix}`, SIDEBAR_WIDTH),
    truncate(windowLine("5h", usage.fiveHour), SIDEBAR_WIDTH),
    truncate(windowLine("Sem", usage.weekly), SIDEBAR_WIDTH),
    truncate(windowLine("Mes", usage.monthly), SIDEBAR_WIDTH),
  ]
}

export function usageSummary(usage) {
  if (!usage) return "sin datos"
  return `5h ${percentLabel(usage.fiveHour.percent)} | Sem ${percentLabel(usage.weekly.percent)} | Mes ${percentLabel(usage.monthly.percent)}`
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
    const [getUsage, setUsage] = createSignal(null)
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
      const apiKey = await resolveClineKey(context)
      if (!apiKey) {
        if (disposed) return
        if (!getUsage()) setError("falta API key")
        setLoading(false)
        return
      }
      try {
        const result = await loadClineUsage(apiKey)
        if (disposed) return
        setUsage(result)
        setError(undefined)
      } catch (err) {
        if (disposed) return
        // Si ya hay un dato bueno, conservarlo en vez de pisarlo con el error.
        if (!getUsage()) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    const showToast = async () => {
      await refresh()
      const current = getUsage()
      const err = getError()
      context.ui?.toast?.show?.({
        title: current?.plan ? `ClinePass · ${current.plan}` : "ClinePass",
        message: err ? `Error: ${err}` : usageSummary(current),
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
      onDispose(registerSlot(context, "sidebar.content", () => renderSidebar({ usage: getUsage(), error: getError(), loading: getLoading() })))
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
                  id: "cline.usage",
                  title: "ClinePass usage",
                  group: "ClinePass",
                  palette: true,
                  slash: { name: "cline-usage" },
                  run: () => {
                    void showToast()
                  },
                },
              ],
              bindings: ["cline.usage"],
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
