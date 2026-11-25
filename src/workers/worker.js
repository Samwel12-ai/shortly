require("../config/env");

const prisma = require("../config/db");
const { getRetryDelayMs } = require("../lib/backoff");

const POLL_INTERVAL = 1000;
const STALE_LOCK_MINUTES = 5;
const BATCH_SIZE = 1;

let stopping = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prisma stores DateTime as UTC in "timestamp without time zone" columns, so the
// raw SQL below compares against (NOW() AT TIME ZONE 'UTC'). Plain NOW() would be
// interpreted in the database session's time zone (Africa/Cairo is UTC+2) and
// could make retries run too early or too late.
async function claimJob() {
  const jobs = await prisma.$queryRaw`
    UPDATE "Job"
    SET
      "status" = 'PROCESSING',
      "lockedAt" = (NOW() AT TIME ZONE 'UTC'),
      "attempts" = "attempts" + 1,
      "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE "id" IN (
      SELECT "id"
      FROM "Job"
      WHERE
        ("status" = 'PENDING' AND "runAt" <= (NOW() AT TIME ZONE 'UTC'))
        OR
        (
          "status" = 'PROCESSING'
          AND "lockedAt" < (NOW() AT TIME ZONE 'UTC') - (${STALE_LOCK_MINUTES} * INTERVAL '1 minute')
        )
      ORDER BY "runAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${BATCH_SIZE}
    )
    RETURNING *
  `;

  return jobs[0] || null;
}

async function processJob(job) {
  const payload = job.payload;
  const linkId = Number(payload.linkId);

  await prisma.$transaction(async (tx) => {
    const link = await tx.link.findUnique({
      where: { id: linkId },
      select: { id: true },
    });

    if (link) {
      await tx.link.update({
        where: { id: linkId },
        data: {
          clickCount: { increment: 1 },
        },
      });

      await tx.clickEvent.create({
        data: {
          linkId,
          ip: payload.ip || null,
          userAgent: payload.userAgent || null,
          referrer: payload.referrer || null,
          // Use the moment of the click, not the moment the worker got to it
          createdAt: payload.clickedAt ? new Date(payload.clickedAt) : undefined,
        },
      });
    }

    await tx.job.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        lockedAt: null,
        lastError: null,
      },
    });
  });

  console.log(`Job ${job.id} completed`);
}

async function handleFailure(job, error) {
  const failedPermanently = job.attempts >= job.maxAttempts;
  const retryDelay = getRetryDelayMs(job.attempts);

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: failedPermanently ? "FAILED" : "PENDING",
      lockedAt: null,
      runAt: failedPermanently ? job.runAt : new Date(Date.now() + retryDelay),
      lastError: String(error.message || error).slice(0, 2000),
    },
  });

  console.error(
    `Job ${job.id} failed (${job.attempts}/${job.maxAttempts}):`,
    error.message || error,
  );
}

async function startWorker() {
  console.log("Job worker started");

  while (!stopping) {
    try {
      const job = await claimJob();

      if (!job) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      try {
        await processJob(job);
      } catch (error) {
        await handleFailure(job, error);
      }
    } catch (error) {
      console.error("Worker polling error:", error.message);
      await sleep(POLL_INTERVAL);
    }
  }

  await prisma.$disconnect();
  console.log("Job worker stopped");
}

function shutdown(signal) {
  console.log(`${signal} received. Stopping worker...`);
  stopping = true;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startWorker().catch(async (error) => {
  console.error("Worker crashed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
