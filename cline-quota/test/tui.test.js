import test from "node:test"
import assert from "node:assert/strict"
import { linesFor, usageSummary } from "../tui.js"

const usage = (overrides = {}) => ({
  plan: "Cline Pass (Monthly)",
  shortPlan: "(Monthly)",
  fiveHour: { percent: 32, known: true },
  weekly: { percent: 10, known: true },
  monthly: { percent: 25, known: true },
  ...overrides,
})

test("linesFor renders the plan and the three windows", () => {
  const lines = linesFor({ usage: usage() })
  assert.equal(lines.length, 4)
  assert.equal(lines[0], "ClinePass · (Monthly)")
  assert.match(lines[1], /^5h ███░░░░░░░ 32%$/)
  assert.match(lines[3], /^Mes ███░░░░░░░ 25%$/)
})

test("linesFor reports loading, empty and error states", () => {
  assert.deepEqual(linesFor({ loading: true }), ["ClinePass", "cargando…"])
  assert.deepEqual(linesFor({ loading: false }), ["ClinePass", "uso no disponible"])
  assert.match(linesFor({ error: "boom" })[1], /^error: boom$/)
})

test("usageSummary joins the three windows", () => {
  assert.equal(usageSummary(usage()), "5h 32% | Sem 10% | Mes 25%")
  assert.equal(usageSummary(null), "sin datos")
})
