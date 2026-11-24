require("./config/env");
const express = require("express");
const cors = require("cors");
const prisma = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const linkRoutes = require("./routes/linkRoutes");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up", uptime: Math.round(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/links", linkRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
