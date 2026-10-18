import test from "node:test"
import assert from "node:assert/strict"
import { linesFor, usageSummary, activeAccounts } from "../tui.js"

const usage = (overrides = {}) => ({
  plan: "Go",
  monthly: { percent: 25, used: 15, cap: 60, resetAt: undefined },
  fiveHour: { percent: 5 },
  weekly: { percent: 50 },
  ...overrides,
})

test("activeAccounts keeps only the active account", () => {
  const result = activeAccounts([
    { id: "a", active: false },
    { id: "b", active: true },
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].id, "b")
})

test("activeAccounts falls back to all accounts when none is active", () => {
  assert.equal(activeAccounts([{ label: "x" }, { label: "y" }]).length, 2)
  assert.equal(activeAccounts([]).length, 0)
  assert.equal(activeAccounts(undefined).length, 0)
})

test("linesFor shows only the account in use, marked with a filled dot", () => {
  const lines = linesFor({
    accounts: [
      { id: "a", label: "A", active: false, usage: usage() },
      { id: "b", label: "B", active: true, usage: usage() },
    ],
  })
  const headers = lines.filter((line) => line.includes("OpenCode"))
  assert.equal(headers.length, 1)
  assert.ok(headers[0].startsWith("● "))
  assert.ok(headers[0].includes("Go B"))
})

test("linesFor renders accounts without id (env/file) without a marker and shows all", () => {
  const lines = linesFor({ accounts: [{ label: "", usage: usage() }, { label: "", usage: usage() }] })
  const headers = lines.filter((line) => line.includes("OpenCode"))
  assert.equal(headers.length, 2)
  assert.ok(!headers.some((line) => line.includes("●") || line.includes("○")))
})

test("linesFor reports loading and empty states", () => {
  assert.deepEqual(linesFor({ accounts: [], loading: true }), ["OpenCode · Go", "cargando…"])
  assert.deepEqual(linesFor({ accounts: [], loading: false }), ["OpenCode · Go", "uso no disponible"])
})

test("usageSummary includes the active marker for store accounts", () => {
  const summary = usageSummary([{ id: "b", label: "2", active: true, usage: usage() }])
  assert.ok(summary.startsWith("● 2:"))
  assert.match(summary, /Mes .* 25%/)
})
