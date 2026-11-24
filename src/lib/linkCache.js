class LRUCache {
  constructor({ max = 1000, ttl = 60_000 } = {}) {
    this.max = max;
    this.ttl = ttl;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.createdAt >= this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.cache.delete(key);
    this.cache.set(key, { value, createdAt: Date.now() });

    while (this.cache.size > this.max) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    return this;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

module.exports = new LRUCache();

module.exports.LRUCache = LRUCache;
