import test from "node:test"
import assert from "node:assert/strict"
import { bar, percentLabel, truncate } from "../lib/format.js"

test("bar fills proportionally and clamps", () => {
  assert.equal(bar(0), "░".repeat(10))
  assert.equal(bar(100), "█".repeat(10))
  assert.equal(bar(50, 4), "██░░")
  assert.equal(bar(150, 4), "████")
})

test("percentLabel rounds", () => {
  assert.equal(percentLabel(18), "18%")
  assert.equal(percentLabel(33.4), "33%")
})

test("truncate adds an ellipsis only when needed", () => {
  assert.equal(truncate("abcdef", 4), "abc…")
  assert.equal(truncate("ab", 4), "ab")
})
