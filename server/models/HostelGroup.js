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

// See Hostel.js / User.js for why the `next` parameter and call were removed.
hostelGroupSchema.pre("validate", function setSlug() {
  if (!this.slug && this.name) {
    this.slug = slugifyText(this.name);
  }
});

hostelGroupSchema.index({ name: "text" });
hostelGroupSchema.index({ slug: 1 });

module.exports = mongoose.model("HostelGroup", hostelGroupSchema);
