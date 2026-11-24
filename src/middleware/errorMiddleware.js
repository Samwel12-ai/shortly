const errorHandler = (err, req, res, next) => {
  // Prisma: unique constraint violation
  if (err.code === "P2002") {
    const target = Array.isArray(err.meta?.target)
      ? err.meta.target[0]
      : "Value";
    const label = target.charAt(0).toUpperCase() + target.slice(1);
    return res.status(409).json({ message: `${label} already exists` });
  }

  // Prisma: record not found (update / delete)
  if (err.code === "P2025") {
    return res.status(404).json({ message: "Resource not found" });
  }

  // Broken JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    message: status >= 500 ? "Something went wrong" : err.message,
  });
};

module.exports = errorHandler;
