const { body, param, query } = require("express-validator");

const urlRule = (required) => {
  const chain = body("originalUrl");
  if (!required) chain.optional();

  return chain
    .isString()
    .withMessage("A valid http(s) URL is required")
    .bail()
    .trim()
    .isLength({ max: 2048 })
    .withMessage("URL is too long")
    .bail()
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("A valid http(s) URL is required");
};

const aliasRule = body("alias")
  .optional({ values: "null" })
  .isString()
  .withMessage("Alias must be a string")
  .bail()
  .matches(/^[A-Za-z0-9_-]{3,32}$/)
  .withMessage("Alias must be 3-32 characters: letters, numbers, - or _");

const expiresAtRule = body("expiresAt")
  .optional({ values: "null" })
  .isISO8601()
  .withMessage("expiresAt must be a valid ISO date")
  .bail()
  .custom((value) => new Date(value) > new Date())
  .withMessage("expiresAt must be in the future")
  .toDate();

const isActiveRule = body("isActive")
  .optional()
  .custom((value) => typeof value === "boolean")
  .withMessage("isActive must be true or false");

const atLeastOneField = body()
  .custom((value) => {
    const data = value || {};
    return ["originalUrl", "isActive", "expiresAt"].some(
      (key) => data[key] !== undefined,
    );
  })
  .withMessage("Provide at least one of: originalUrl, isActive, expiresAt");

const createLinkValidation = [urlRule(true), aliasRule, expiresAtRule];

const updateLinkValidation = [
  atLeastOneField,
  urlRule(false),
  isActiveRule,
  expiresAtRule,
];

const idValidation = [
  param("id").isInt({ min: 1, max: 2147483647 }).withMessage("Invalid link id"),
];

const listValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];

module.exports = {
  createLinkValidation,
  updateLinkValidation,
  idValidation,
  listValidation,
};
