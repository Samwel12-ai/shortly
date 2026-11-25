const prisma = require("../config/db");

// Request headers are user-controlled, so cap what we store
const clip = (value, max) => (value ? String(value).slice(0, max) : null);

async function enqueueClickAnalytics({
  linkId,
  clickedAt,
  ip,
  userAgent,
  referrer,
}) {
  return prisma.job.create({
    data: {
      type: "CLICK_ANALYTICS",
      payload: {
        linkId,
        // The worker may process this seconds later; keep the real click time
        clickedAt: clickedAt || new Date().toISOString(),
        ip: clip(ip, 64),
        userAgent: clip(userAgent, 512),
        referrer: clip(referrer, 2048),
      },
    },
  });
}

module.exports = {
  enqueueClickAnalytics,
};
