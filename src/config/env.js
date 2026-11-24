require("dotenv").config();

const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port,
  baseUrl: process.env.BASE_URL || `http://localhost:${port}`,
  jwtSecret: process.env.JWT_SECRET,
};
