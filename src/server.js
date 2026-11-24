const config = require("./config/env");
const app = require("./app");
const prisma = require("./config/db");

const server = app.listen(config.port, () => {
  console.log(`API listening on port ${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown: stop accepting connections, let in-flight requests finish, close the DB
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);

  server.close(async () => {
    await prisma.$disconnect();
    console.log("Shutdown complete");
    process.exit(0);
  });

  // If something hangs, force exit after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
