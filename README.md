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

## API

| Method | Endpoint             | Auth   | Description                                            |
| ------ | -------------------- | ------ | ------------------------------------------------------ |
| POST   | `/api/auth/register` | Public | Create an account                                      |
| POST   | `/api/auth/login`    | Public | Log in and receive a JWT                               |
| POST   | `/api/links`         | JWT    | Create a short link (optional custom alias and expiry) |
| GET    | `/api/links`         | JWT    | List your links (`?page=1&limit=20`)                   |
| GET    | `/api/links/:id`     | JWT    | Get one link                                           |
| PATCH  | `/api/links/:id`     | JWT    | Update URL, active flag or expiry                      |
| DELETE | `/api/links/:id`     | JWT    | Delete a link                                          |

## More design decisions

4. **Short codes** are 7 random base62 characters generated with `crypto.randomInt`. The unique index detects collisions and we retry, instead of checking first, which avoids a race condition.
5. **A link that belongs to someone else returns 404, not 403**, so link ids cannot be probed.
6. **Login runs a bcrypt comparison even when the email does not exist**, so response time does not reveal which emails are registered.
