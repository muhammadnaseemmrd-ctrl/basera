const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

const hostelGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: String,
    logoUrl: String,
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    verified: { type: Boolean, default: false },
    foundedYear: Number,
    citiesPresent: [String]
  },
  { timestamps: true }
);

hostelGroupSchema.pre("validate", function setSlug(next) {
  if (!this.slug && this.name) {
    this.slug = slugifyText(this.name);
  }
  next();
});

hostelGroupSchema.index({ name: "text" });
hostelGroupSchema.index({ slug: 1 });

module.exports = mongoose.model("HostelGroup", hostelGroupSchema);
