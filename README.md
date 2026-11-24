# Shortly

A URL shortener built to demonstrate caching, queueing and a layered architecture, using only Node.js, Express, PostgreSQL and Prisma. No Redis and no external queue.

## Architecture

```
Client ─► API process ─► LRU cache ──hit──► 302 redirect
              │              │ miss
              │              ▼
              │          PostgreSQL ─► fill cache
              │
              └─► jobs table (PostgreSQL) ◄── Worker process (separate)
                                                  └─► click_events + retry / dead-letter
```

## Design decisions

1. **The API and the worker are separate processes.** The redirect path stays fast, and analytics are written asynchronously by the worker. They only communicate through the database.
2. **The queue lives in PostgreSQL.** Jobs have status, attempts, `runAt` (for backoff) and `lockedAt` (to recover from crashed workers). Jobs that exceed `maxAttempts` stay as `FAILED` (dead-letter).
3. **`app.js` and `server.js` are split**, so the app can be tested without opening a port.

