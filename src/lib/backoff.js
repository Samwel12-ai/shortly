// Exponential backoff: 1s, 2s, 4s, 8s... capped at maxMs
function getRetryDelayMs(attempts, { baseMs = 1000, maxMs = 60_000 } = {}) {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));
}

module.exports = { getRetryDelayMs };
