const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: "Validation failed.",
      errors: errors.array().map((error) => ({ field: error.path, message: error.msg }))
    });
  }
  return next();
};

module.exports = validate;
