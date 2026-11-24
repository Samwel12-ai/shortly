const express = require("express");
const {
  create,
  list,
  getOne,
  update,
  remove,
} = require("../controllers/linkController");
const authenticateToken = require("../middleware/authMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
  createLinkValidation,
  updateLinkValidation,
  idValidation,
  listValidation,
} = require("../validators/linkValidator");

const router = express.Router();

router.use(authenticateToken);

router.post("/", createLinkValidation, validate, create);
router.get("/", listValidation, validate, list);
router.get("/:id", idValidation, validate, getOne);
router.patch("/:id", idValidation, updateLinkValidation, validate, update);
router.delete("/:id", idValidation, validate, remove);

module.exports = router;
