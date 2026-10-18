import test from "node:test"
import assert from "node:assert/strict"
import { bar, percentLabel, countdown, truncate, windowLine } from "../lib/format.js"

test("bar fills proportionally and clamps", () => {
  assert.equal(bar(0, 10), "░".repeat(10))
  assert.equal(bar(100, 10), "█".repeat(10))
  assert.equal(bar(50, 10), "█".repeat(5) + "░".repeat(5))
  assert.equal(bar(150, 4), "████")
  assert.equal(bar(-10, 4), "░░░░")
})

test("percentLabel rounds", () => {
  assert.equal(percentLabel(32.6), "33%")
  assert.equal(percentLabel(0), "0%")
})

test("countdown is compact and handles past/empty", () => {
  const now = 1_000_000
  assert.equal(countdown(0, now), "")
  assert.equal(countdown(now - 1, now), "now")
  assert.equal(countdown(now + 30 * 60_000, now), "30m")
  assert.equal(countdown(now + 3_661_000, now), "1h 1m")
  assert.equal(countdown(now + 90_000_000, now), "1d 1h")
})

test("truncate adds an ellipsis only when needed", () => {
  assert.equal(truncate("abcdef", 4), "abc…")
  assert.equal(truncate("ab", 4), "ab")
})

test("windowLine renders a bar, percent and optional countdown", () => {
  assert.equal(windowLine("5h", { percent: 50 }), "5h █████░░░░░ 50%")
  assert.match(windowLine("Mes", { percent: 25, resetAt: Date.now() + 3_600_000 }), /^Mes ███░░░░░░░ 25% · 1h 0m$/)
})
