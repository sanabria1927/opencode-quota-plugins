import test from "node:test"
import assert from "node:assert/strict"
import { resolveGoAccounts, resolveGoKey, loadGoUsage, loadAllGoUsages, GO_LIMITS } from "../lib/usage.js"

// Aísla de variables de entorno del runner y de un auth.json real.
for (const key of [
  "OPENCODE_GO_API_KEYS",
  "OPENCODE_GO_API_KEY",
  "OPENCODE_GO_API_KEY_2",
  "OPENCODE_GO_LABELS",
  "OPENCODE_GO_LABEL",
  "OPENCODE_GO_LABEL_2",
  "OPENCODE_GO_AUTH_FILES",
  "OPENCODE_GO_AUTH_FILE_2",
]) delete process.env[key]
process.env.OPENCODE_GO_AUTH_FILE = "/nonexistent/opencode-go/auth.json"

const storeContext = (entries) => ({ client: { credential: { list: async () => ({ data: entries }) } } })

test("resolveGoAccounts reads the V2 store and puts the active account first", async () => {
  const context = storeContext([
    { id: "a", integrationID: "opencode-go", label: "OpenCode Go", active: false, value: { type: "key", key: "k1" } },
    { id: "b", integrationID: "opencode-go", label: "OpenCode Go 2", active: true, value: { type: "key", key: "k2" } },
  ])
  const accounts = await resolveGoAccounts(context)
  assert.equal(accounts.length, 2)
  assert.equal(accounts[0].id, "b")
  assert.equal(accounts[0].active, true)
  assert.equal(accounts[1].id, "a")
})

test("resolveGoAccounts ignores credentials of other integrations and empty keys", async () => {
  const context = storeContext([
    { id: "x", integrationID: "openai", active: true, value: { type: "oauth", access: "z" } },
    { id: "y", integrationID: "opencode-go", active: true, value: { type: "key", key: "  " } },
  ])
  assert.deepEqual(await resolveGoAccounts(context), [])
})

test("resolveGoAccounts prefers the environment override", async () => {
  process.env.OPENCODE_GO_API_KEYS = "env1,env2"
  try {
    const accounts = await resolveGoAccounts(storeContext([]))
    assert.equal(accounts.length, 2)
    assert.equal(accounts[0].key, "env1")
  } finally {
    delete process.env.OPENCODE_GO_API_KEYS
  }
})

test("resolveGoKey returns the primary account key", async () => {
  const context = storeContext([{ id: "a", integrationID: "opencode-go", active: true, value: { type: "key", key: "solo" } }])
  assert.equal(await resolveGoKey(context), "solo")
})

test("loadGoUsage normalizes windows against the documented caps", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ usage: { rolling: { percent: 50 }, weekly: { percent: 10 }, monthly: { percent: 25 } } }),
  })
  try {
    const usage = await loadGoUsage("k")
    assert.equal(usage.plan, "Go")
    assert.equal(usage.fiveHour.percent, 50)
    assert.equal(usage.fiveHour.cap, GO_LIMITS.fiveHour)
    assert.equal(usage.fiveHour.used, 6)
    assert.equal(usage.monthly.used, 15)
  } finally {
    globalThis.fetch = original
  }
})

test("loadGoUsage throws a readable error on HTTP failure", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 429 })
  try {
    await assert.rejects(() => loadGoUsage("k"), /HTTP 429/)
  } finally {
    globalThis.fetch = original
  }
})

test("loadAllGoUsages isolates per-account errors", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (_url, options) =>
    options.headers.Authorization === "Bearer bad"
      ? { ok: false, status: 401 }
      : { ok: true, json: async () => ({ usage: { monthly: { percent: 25 } } }) }
  try {
    const results = await loadAllGoUsages([
      { label: "A", key: "good" },
      { label: "B", key: "bad" },
    ])
    assert.equal(results[0].usage.monthly.percent, 25)
    assert.match(results[1].error, /HTTP 401/)
  } finally {
    globalThis.fetch = original
  }
})
