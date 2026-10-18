import test from "node:test"
import assert from "node:assert/strict"
import { resolveClineKey, loadClineUsage } from "../lib/usage.js"

// Aísla de variables de entorno del runner.
delete process.env.CLINE_API_KEY

const storeContext = (entries) => ({ client: { credential: { list: async () => ({ data: entries }) } } })

test("resolveClineKey prefers the environment", async () => {
  process.env.CLINE_API_KEY = "env-key"
  try {
    assert.equal(await resolveClineKey({}), "env-key")
  } finally {
    delete process.env.CLINE_API_KEY
  }
})

test("resolveClineKey reads the active cline-pass credential from the V2 store", async () => {
  const context = storeContext([
    { integrationID: "cline-pass", active: false, value: { type: "key", key: "old" } },
    { integrationID: "cline-pass", active: true, value: { type: "key", key: "fresh" } },
  ])
  assert.equal(await resolveClineKey(context), "fresh")
})

test("resolveClineKey ignores other integrations", async () => {
  const context = storeContext([{ integrationID: "opencode-go", active: true, value: { type: "key", key: "nope" } }])
  assert.equal(await resolveClineKey(context), undefined)
})

test("loadClineUsage normalizes limits, clamps percent and strips the plan suffix", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/plan")) {
      return { ok: true, json: async () => ({ data: { plan: { displayName: "Cline Pass (Monthly)[Internal]" } } }) }
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          limits: [
            { type: "five_hour", percentUsed: 32, resetsAt: "2030-01-01T00:00:00Z" },
            { type: "weekly", percentUsed: 10 },
            { type: "monthly", percentUsed: 150 },
          ],
        },
      }),
    }
  }
  try {
    const usage = await loadClineUsage("key")
    assert.equal(usage.plan, "Cline Pass (Monthly)")
    assert.equal(usage.shortPlan, "(Monthly)")
    assert.equal(usage.fiveHour.percent, 32)
    assert.equal(usage.fiveHour.known, true)
    assert.ok(Number.isFinite(usage.fiveHour.resetAt))
    assert.equal(usage.monthly.percent, 100) // clamped
    assert.equal(usage.weekly.known, true)
  } finally {
    globalThis.fetch = original
  }
})

test("loadClineUsage marks missing windows as unknown and tolerates a failing plan call", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/plan")) return { ok: false, status: 404 }
    return { ok: true, json: async () => ({ data: { limits: [{ type: "monthly", percentUsed: 5 }] } }) }
  }
  try {
    const usage = await loadClineUsage("key")
    assert.equal(usage.plan, "ClinePass")
    assert.equal(usage.shortPlan, "")
    assert.equal(usage.fiveHour.known, false)
    assert.equal(usage.monthly.percent, 5)
  } finally {
    globalThis.fetch = original
  }
})

test("loadClineUsage throws a readable error on HTTP failure", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 401 })
  try {
    await assert.rejects(() => loadClineUsage("key"), /HTTP 401/)
  } finally {
    globalThis.fetch = original
  }
})
