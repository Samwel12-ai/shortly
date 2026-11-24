const prisma = require("../config/db");
const config = require("../config/env");
const HttpError = require("../lib/httpError");
const { generateCode } = require("../lib/code");
const linkCache = require("../lib/linkCache");
const { enqueueClickAnalytics } = require("./jobQueue");

const RESERVED_CODES = new Set(["api", "health", "metrics", "admin"]);
const MAX_CODE_ATTEMPTS = 5;

const toDto = (link) => ({
  id: link.id,
  code: link.code,
  shortUrl: `${config.baseUrl}/${link.code}`,
  originalUrl: link.originalUrl,
  isActive: link.isActive,
  expiresAt: link.expiresAt,
  clickCount: link.clickCount,
  userId: link.userId,
  createdAt: link.createdAt,
});

// A user sees only his own links, an ADMIN sees all of them
const scope = (user, extra = {}) =>
  user.role === "ADMIN" ? extra : { ...extra, userId: user.id };

async function createLink(user, { originalUrl, alias, expiresAt }) {
  if (alias) {
    if (RESERVED_CODES.has(alias.toLowerCase())) {
      throw new HttpError(400, "This alias is reserved");
    }

    try {
      const link = await prisma.link.create({
        data: { code: alias, originalUrl, expiresAt, userId: user.id },
      });
      return toDto(link);
    } catch (err) {
      if (err.code === "P2002")
        throw new HttpError(409, "Alias is already taken");
      throw err;
    }
  }

  // Random code: the unique index detects a collision, we just retry
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const link = await prisma.link.create({
        data: { code: generateCode(), originalUrl, expiresAt, userId: user.id },
      });
      return toDto(link);
    } catch (err) {
      if (err.code !== "P2002") throw err;
    }
  }

  throw new HttpError(500, "Could not generate a unique code");
}

async function listLinks(user, { page, limit }) {
  const where = scope(user);

  const [items, total] = await prisma.$transaction([
    prisma.link.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.link.count({ where }),
  ]);

  return {
    data: items.map(toDto),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

async function getLink(user, id) {
  const link = await prisma.link.findFirst({ where: scope(user, { id }) });

  if (!link) throw new HttpError(404, "Link not found");

  return toDto(link);
}

async function updateLink(user, id, changes) {
  const existing = await prisma.link.findFirst({ where: scope(user, { id }) });

  if (!existing) throw new HttpError(404, "Link not found");

  const data = {};
  for (const key of ["originalUrl", "isActive", "expiresAt"]) {
    if (changes[key] !== undefined) data[key] = changes[key];
  }

  const link = await prisma.link.update({ where: { id }, data });

  linkCache.delete(existing.code);

  return toDto(link);
}

async function deleteLink(user, id) {
  const existing = await prisma.link.findFirst({ where: scope(user, { id }) });

  if (!existing) throw new HttpError(404, "Link not found");

  await prisma.link.delete({ where: { id } });

  linkCache.delete(existing.code);
}

async function redirectLink(code, metadata = {}) {
  let link = linkCache.get(code);

  if (!link) {
    link = await prisma.link.findUnique({
      where: { code },
    });

    if (!link) {
      throw new HttpError(404, "Link not found");
    }

    linkCache.set(code, link);
  }

  if (!link.isActive) {
    throw new HttpError(410, "Link is disabled");
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    throw new HttpError(410, "Link has expired");
  }

  await enqueueClickAnalytics({
    linkId: link.id,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    referrer: metadata.referrer,
  });

  return link.originalUrl;
}

module.exports = {
  createLink,
  listLinks,
  getLink,
  updateLink,
  deleteLink,
  redirectLink,
};
