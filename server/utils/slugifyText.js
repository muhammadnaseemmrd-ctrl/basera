const slugify = require("slugify");

const slugifyText = (value) =>
  slugify(value || "", {
    lower: true,
    strict: true,
    trim: true
  });

module.exports = slugifyText;
