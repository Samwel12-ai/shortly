const prisma = require("../config/db");

async function enqueueClickAnalytics({ linkId, ip, userAgent, referrer }) {
  return prisma.job.create({
    data: {
      type: "CLICK_ANALYTICS",
      payload: {
        linkId,
        ip: ip || null,
        userAgent: userAgent || null,
        referrer: referrer || null,
      },
    },
  });
}

module.exports = {
  enqueueClickAnalytics,
};
