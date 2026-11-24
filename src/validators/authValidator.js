const { body } = require("express-validator");

const emailRule = body("email")
  .isString()
  .withMessage("Valid email is required")
  .bail()
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage("Valid email is required");

const registerValidation = [
  body("name")
    .isString()
    .withMessage("Name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name is too long"),

  emailRule,

  body("password")
    .isString()
    .withMessage("Password is required")
    .bail()
    .isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters"),
];

const loginValidation = [
  emailRule,
  body("password")
    .isString()
    .withMessage("Password is required")
    .bail()
    .notEmpty()
    .withMessage("Password is required"),
];

module.exports = { registerValidation, loginValidation };
