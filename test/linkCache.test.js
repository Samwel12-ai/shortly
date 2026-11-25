const { test } = require("node:test");
const assert = require("node:assert/strict");
const { LRUCache } = require("../src/lib/linkCache");

test("stores and returns values", () => {
  const cache = new LRUCache();
  cache.set("a", 1);

  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("missing"), undefined);
});

test("evicts the least recently used entry when it is full", () => {
  const cache = new LRUCache({ max: 2 });

  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a"); // "a" is now the most recently used, so "b" is the oldest
  cache.set("c", 3);

  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.size, 2);
});

test("overwriting a key does not grow the cache", () => {
  const cache = new LRUCache({ max: 2 });

  cache.set("a", 1);
  cache.set("a", 2);

  assert.equal(cache.get("a"), 2);
  assert.equal(cache.size, 1);
});

test("entries expire after the TTL", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const cache = new LRUCache({ ttl: 1000 });

  cache.set("a", 1);

  t.mock.timers.tick(999);
  assert.equal(cache.get("a"), 1);

  t.mock.timers.tick(1);
  assert.equal(cache.get("a"), undefined);
});

test("delete removes an entry", () => {
  const cache = new LRUCache();
  cache.set("a", 1);

  assert.equal(cache.delete("a"), true);
  assert.equal(cache.get("a"), undefined);
});
