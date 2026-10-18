import test from "node:test"
import assert from "node:assert/strict"
import { bar, money, percentLabel, countdown, truncate, windowLine, monthLine } from "../lib/format.js"

test("bar fills proportionally and clamps", () => {
  assert.equal(bar(0, 10), "░".repeat(10))
  assert.equal(bar(100, 10), "█".repeat(10))
  assert.equal(bar(50, 10), "█".repeat(5) + "░".repeat(5))
  assert.equal(bar(150, 4), "█".repeat(4))
  assert.equal(bar(-10, 4), "░".repeat(4))
})

test("percentLabel rounds", () => {
  assert.equal(percentLabel(33.6), "34%")
  assert.equal(percentLabel(0), "0%")
})

test("money formats USD", () => {
  assert.equal(money(15), "$15.00")
  assert.equal(money(6.5), "$6.50")
  assert.equal(money(undefined), "$0.00")
})

test("countdown is compact and handles past/empty", () => {
  const now = 1_000_000
  assert.equal(countdown(0, now), "")
  assert.equal(countdown(now - 1, now), "now")
  assert.equal(countdown(now + 59 * 60_000, now), "59m")
  assert.equal(countdown(now + 3_661_000, now), "1h 1m")
  assert.equal(countdown(now + 90_000_000, now), "1d 1h")
})

test("truncate adds an ellipsis only when needed", () => {
  assert.equal(truncate("abcdef", 4), "abc…")
  assert.equal(truncate("ab", 4), "ab")
})

test("windowLine and monthLine render a bar, percent and countdown", () => {
  const resetAt = Date.now() + 3_600_000
  assert.match(windowLine("5h", { percent: 50, resetAt }), /^5h █{5}░{5} 50% · 1h 0m$/)
  assert.match(monthLine({ percent: 25 }), /^Mes ███░░░░░░░ 25%$/)
})
