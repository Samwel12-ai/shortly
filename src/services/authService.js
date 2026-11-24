const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const config = require("../config/env");
const HttpError = require("../lib/httpError");

// Compared against when the email doesn't exist, so response time
// doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

async function register({ name, email, password }) {
  const hashed = await bcrypt.hash(password, 10);

  // Duplicate email -> Prisma P2002 -> errorMiddleware answers 409
  return prisma.user.create({
    data: { name, email, password: hashed },
    select: { id: true, name: true, email: true, role: true },
  });
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  const match = await bcrypt.compare(
    password,
    user ? user.password : DUMMY_HASH,
  );

  if (!user || !match) {
    throw new HttpError(401, "Invalid email or password");
  }

  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: "1d" },
  );
}

module.exports = { register, login };
