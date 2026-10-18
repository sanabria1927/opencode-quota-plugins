import test from "node:test"
import assert from "node:assert/strict"
import { durationText, windowLabel, probeCodex, resolveCodexAuth } from "../lib/usage.js"

// Aísla de variables de entorno del runner.
for (const key of ["OPENCODE_CODEX_ACCESS_TOKEN", "OPENCODE_CODEX_ACCOUNT_ID"]) delete process.env[key]

test("durationText formats seconds", () => {
  assert.equal(durationText("3661"), "1h 1m")
  assert.equal(durationText(90), "1m")
  assert.equal(durationText(45), "45s")
  assert.equal(durationText(undefined), undefined)
})

test("windowLabel renders a compact window", () => {
  assert.equal(windowLabel(300, "?"), "5h")
  assert.equal(windowLabel(10080, "?"), "7d")
  assert.equal(windowLabel(90, "?"), "90m")
  assert.equal(windowLabel(undefined, "fallback"), "fallback")
})

test("resolveCodexAuth prefers the environment", async () => {
  process.env.OPENCODE_CODEX_ACCESS_TOKEN = "env-token"
  process.env.OPENCODE_CODEX_ACCOUNT_ID = "env-account"
  try {
    assert.deepEqual(await resolveCodexAuth({}), { access: "env-token", accountId: "env-account" })
  } finally {
    delete process.env.OPENCODE_CODEX_ACCESS_TOKEN
    delete process.env.OPENCODE_CODEX_ACCOUNT_ID
  }
})

test("resolveCodexAuth reads the active OAuth credential from the V2 store", async () => {
  const context = {
    client: {
      credential: {
        list: async () => ({
          data: [
            { integrationID: "openai", active: false, value: { type: "oauth", access: "old", metadata: {} } },
            { integrationID: "openai", active: true, value: { type: "oauth", access: "fresh", metadata: { accountID: "AID" } } },
          ],
        }),
      },
    },
  }
  assert.deepEqual(await resolveCodexAuth(context), { access: "fresh", accountId: "AID" })
})

test("probeCodex reads quota from the response headers", async () => {
  const headers = {
    "x-codex-primary-used-percent": "18",
    "x-codex-primary-window-minutes": "300",
    "x-codex-primary-reset-after-seconds": "3661",
    "x-codex-secondary-used-percent": "3",
    "x-codex-secondary-window-minutes": "10080",
    "x-codex-secondary-reset-after-seconds": "600000",
    "x-codex-plan-type": "plus",
  }
  const fetchImpl = async (url) =>
    String(url).includes("/models")
      ? { ok: true, json: async () => ({ models: [{ slug: "gpt-5-codex" }] }) }
      : { ok: true, text: async () => "", headers: { get: (name) => headers[name] } }

  const result = await probeCodex({ access: "a", accountId: "acct" }, fetchImpl, 1000)
  assert.equal(result.plan, "plus")
  assert.deepEqual(result.primary, { percent: 18, reset: "1h 1m", windowMinutes: 300 })
  assert.equal(result.secondary.percent, 3)
  assert.equal(result.secondary.windowMinutes, 10080)
})
