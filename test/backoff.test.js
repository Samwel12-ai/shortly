const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getRetryDelayMs } = require("../src/lib/backoff");

test("the delay doubles after every failed attempt", () => {
  assert.equal(getRetryDelayMs(1), 1000);
  assert.equal(getRetryDelayMs(2), 2000);
  assert.equal(getRetryDelayMs(3), 4000);
  assert.equal(getRetryDelayMs(4), 8000);
});

test("the delay never exceeds the maximum", () => {
  assert.equal(getRetryDelayMs(20), 60_000);
});

test("handles attempts = 0 without going below the base delay", () => {
  assert.equal(getRetryDelayMs(0), 1000);
});
