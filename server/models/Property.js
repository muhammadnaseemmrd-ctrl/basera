const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

// Hotels & guest houses are a deliberately separate vertical from the student-hostel
// `Hostel`/`Room` models: nightly pricing instead of monthly rent, a date-range stay
// instead of a move-in date, and no university-proximity framing. Kept as its own model
// (rather than bolting a `propertyType` flag onto Hostel.js) because Hostel/Room are
// already deeply threaded through the student flow (nearbyUniversities, mess menus,
// per-bed monthly pricing, availability-by-bed calculations, etc.) -- reusing them here
// would mean either fighting those assumptions or leaving a pile of irrelevant fields on
// every hotel listing. See StayBooking.js for the matching nightly-stay booking model.
const imageSchema = new mongoose.Schema({ url: String, caption: String }, { _id: false });

const propertySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    propertyType: { type: String, enum: ["hotel", "guest_house"], required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: String,
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: {
      lat: Number,
      lng: Number,
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }
    },
    images: [imageSchema],
    facilities: [String],
    nightlyRatePkr: { type: Number, required: true },
    maxGuests: { type: Number, default: 2 },
    checkInTime: { type: String, default: "14:00" },
    checkOutTime: { type: String, default: "12:00" },
    totalRooms: { type: Number, default: 1 },
    // A business contact number for the property, shown openly on the listing (like any
    // hotel/guest-house listing on a travel site) -- not subject to the long-term
    // contact-gating rules built for individual host/tenant relationships.
    contactPhone: String,
    isVerified: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive", "pending"], default: "pending" },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// See Hostel.js / User.js for why the `next` parameter and call were removed --
// Mongoose 9 doesn't supply a real `next` to hooks anymore, callback-style or not.
propertySchema.pre("validate", function setSlugAndPoint() {
  if (!this.slug && this.name) {
    this.slug = slugifyText(`${this.name}-${this.area}-${this.city}`);
  }
  if (this.location?.lat && this.location?.lng) {
    this.location.coordinates = [this.location.lng, this.location.lat];
  }
});

propertySchema.index({ city: 1, propertyType: 1, status: 1 });
propertySchema.index({ slug: 1 });
propertySchema.index({ owner: 1 });
propertySchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Property", propertySchema);
