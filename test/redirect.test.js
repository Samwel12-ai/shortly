const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL = "postgresql://test";
process.env.JWT_SECRET = "test-secret";

// Replace the database and env modules with fakes, so these tests run
// without PostgreSQL. linkService gets the fakes because require() reads the cache first.
function stub(modulePath, exports) {
  const filename = require.resolve(modulePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const state = { findUnique: 0, jobCreate: 0, lastJob: null, jobShouldFail: false, row: null };

stub("../src/config/db", {
  link: {
    findUnique: async () => {
      state.findUnique++;
      return state.row;
    },
  },
  job: {
    create: async (args) => {
      state.jobCreate++;
      state.lastJob = args;
      if (state.jobShouldFail) throw new Error("database is down");
      return {};
    },
  },
});
stub("../src/config/env", { baseUrl: "http://localhost:3000", jwtSecret: "x" });

const linkCache = require("../src/lib/linkCache");
const { redirectLink } = require("../src/services/linkService");

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  linkCache.clear();
  state.findUnique = 0;
  state.jobCreate = 0;
  state.lastJob = null;
  state.jobShouldFail = false;
  state.row = {
    id: 1,
    code: "abc1234",
    originalUrl: "https://example.com/target",
    isActive: true,
    expiresAt: null,
  };
});

test("returns the original URL and queues a click event", async () => {
  const url = await redirectLink("abc1234", { ip: "1.2.3.4" });
  await flush();

  assert.equal(url, "https://example.com/target");
  assert.equal(state.jobCreate, 1);
  assert.equal(state.lastJob.data.payload.linkId, 1);
});

test("repeat requests are served from the cache without a database read", async () => {
  await redirectLink("abc1234");
  await redirectLink("abc1234");
  await redirectLink("abc1234");

  assert.equal(state.findUnique, 1);
});

test("an unknown code returns 404", async () => {
  state.row = null;

  await assert.rejects(redirectLink("nope123"), { status: 404 });
});

test("a malformed code returns 404 without touching the database", async () => {
  await assert.rejects(redirectLink("favicon.ico"), { status: 404 });

  assert.equal(state.findUnique, 0);
});

test("a disabled link returns 410 and records no click", async () => {
  state.row.isActive = false;

  await assert.rejects(redirectLink("abc1234"), { status: 410 });
  await flush();

  assert.equal(state.jobCreate, 0);
});

test("an expired link returns 410", async () => {
  state.row.expiresAt = new Date(Date.now() - 1000);

  await assert.rejects(redirectLink("abc1234"), { status: 410 });
});

test("a cached link is rejected once its expiry date passes", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  state.row.expiresAt = new Date(1000);

  assert.equal(await redirectLink("abc1234"), "https://example.com/target");

  t.mock.timers.tick(1500); // still inside the cache TTL, but past expiresAt

  await assert.rejects(redirectLink("abc1234"), { status: 410 });
  assert.equal(state.findUnique, 1); // second answer came from the cache
});

test("a failing analytics insert never breaks the redirect", async () => {
  state.jobShouldFail = true;

  const url = await redirectLink("abc1234");
  await flush();

  assert.equal(url, "https://example.com/target");
});

test("stored request metadata is length-capped", async () => {
  await redirectLink("abc1234", { userAgent: "x".repeat(5000) });
  await flush();

  assert.equal(state.lastJob.data.payload.userAgent.length, 512);
});
