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

Code is layered as `routes → controllers → services`. Controllers never touch the database; services hold the logic and talk to Prisma.

## How it works

**Redirects.** `GET /:code` looks the code up in an in-memory LRU cache (1000 entries, 60 s TTL) and only queries PostgreSQL on a miss. The cache entry is removed when a link is updated or deleted, and `isActive` / `expiresAt` are checked on every request, so a cached link can never outlive its expiry date. Codes with an invalid format (for example `/favicon.ico`) are rejected before any lookup.

**Click analytics.** Every redirect inserts a `CLICK_ANALYTICS` job and does not wait for it: a slow or failing insert can never slow down or break a redirect. A separate worker process picks jobs up and, in one transaction, increments `clickCount`, stores a `ClickEvent` and marks the job `DONE`.

**Queue.** The queue is a PostgreSQL table.

- Jobs are claimed with `UPDATE ... FOR UPDATE SKIP LOCKED`, so several workers can run in parallel without taking the same job.
- A failed job is retried with exponential backoff (1 s, 2 s, 4 s ... capped at 60 s) using the `runAt` column.
- After `maxAttempts` (5) a job stays as `FAILED`. This is the dead-letter state, kept for inspection.
- A job stuck in `PROCESSING` for more than 5 minutes (a crashed worker) is claimed again.
- The worker finishes its current job before exiting on `SIGINT` / `SIGTERM`.

## Design decisions

1. **The API and the worker are separate processes.** The redirect path stays fast, and analytics are written asynchronously. They only communicate through the database.
2. **`app.js` and `server.js` are split**, so the app can be tested without opening a port.
3. **Short codes** are 7 random base62 characters generated with `crypto.randomInt`. The unique index detects collisions and we retry, instead of checking first, which avoids a race condition.
4. **A link that belongs to someone else returns 404, not 403**, so link ids cannot be probed.
5. **Login runs a bcrypt comparison even when the email does not exist**, so response time does not reveal which emails are registered.
6. **Redirects use 302, not 301**, so browsers do not cache them forever and clicks keep being counted.
7. **Click time is captured at redirect time** and stored in the job, so the analytics are correct even if the worker is behind.

## Trade-offs and limitations

- **The cache lives in the memory of one process.** With several API instances each has its own cache, and an update invalidates only the instance that handled it; the 60 s TTL bounds how stale another instance can be. A shared cache (for example Redis) would fix that.
- **The queue is a database table.** It is simple and transactional, but slower than a real broker and every click costs one `INSERT`. At high volume, clicks should be batched or moved to a broker.
- **Finished jobs are not cleaned up yet**, so the `Job` table grows by one row per click.
- Raw IP addresses are stored in `ClickEvent`. Hash or truncate them if privacy matters.

## API

| Method | Endpoint             | Auth   | Description                                                      |
| ------ | -------------------- | ------ | ---------------------------------------------------------------- |
| GET    | `/:code`             | Public | Redirect (302) to the original URL. 404 if unknown, 410 if disabled or expired |
| GET    | `/health`            | Public | Liveness and database check                                      |
| POST   | `/api/auth/register` | Public | Create an account                                                |
| POST   | `/api/auth/login`    | Public | Log in and receive a JWT                                         |
| POST   | `/api/links`         | JWT    | Create a short link (optional custom alias and expiry)           |
| GET    | `/api/links`         | JWT    | List your links (`?page=1&limit=20`)                             |
| GET    | `/api/links/:id`     | JWT    | Get one link                                                     |
| PATCH  | `/api/links/:id`     | JWT    | Update URL, active flag or expiry                                |
| DELETE | `/api/links/:id`     | JWT    | Delete a link                                                    |

Users see only their own links; an `ADMIN` sees all of them.

## Getting Started

### Requirements

- Node.js 18 or newer
- PostgreSQL

### Installation

```bash
git clone <repository-url>
cd shortly
npm install
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/shortly_db"
JWT_SECRET="a-long-random-string"
PORT=3000
BASE_URL="http://localhost:3000"
```

### Database Setup

```bash
npm run prisma:generate
npm run prisma:push
```

### Run the API

```bash
npm run dev
```

### Run the Background Worker

Open a separate terminal:

```bash
npm run worker
```

Without the worker, redirects still work, but clicks are only counted once it runs.

### Run Tests

```bash
npm test
```

The tests use Node's built-in test runner and need no database: they cover the LRU cache, the redirect logic (caching, expiry, 404/410 handling, analytics failures) and the retry backoff.
