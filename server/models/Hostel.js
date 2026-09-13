const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

const nearbyUniversitySchema = new mongoose.Schema(
  {
    name: String,
    distanceKm: Number
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: String,
    caption: String
  },
  { _id: false }
);

const verificationDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["identity", "property", "license"],
      required: true
    },
    label: String,
    url: { type: String, required: true },
    originalName: String,
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    }
  },
  { _id: false }
);

const ownerAgreementSchema = new mongoose.Schema(
  {
    accepted: { type: Boolean, default: false },
    offPlatformPolicyAccepted: { type: Boolean, default: false },
    signedBy: String,
    signerCnic: String,
    version: { type: String, default: "host-agreement-v3" },
    signedAt: Date,
    ipAddress: String
  },
  { _id: false }
);

const ownerVerificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending"
    },
    identityDocument: verificationDocumentSchema,
    propertyDocument: verificationDocumentSchema,
    licenseDocument: verificationDocumentSchema,
    agreement: ownerAgreementSchema,
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: String
  },
  { _id: false }
);

const hostelSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "HostelGroup", default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: String,
    type: { type: String, enum: ["boys", "girls", "mixed"], required: true },
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: {
      lat: Number,
      lng: Number,
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }
    },
    nearbyUniversities: [nearbyUniversitySchema],
    images: [imageSchema],
    amenities: [String],
    rules: [String],
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    availabilityLeft: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive", "pending"], default: "pending" },
    messMenu: {
      breakfast: [String],
      lunch: [String],
      dinner: [String]
    },
    contactPhone: String,
    contactWhatsApp: String,
    ownerVerification: ownerVerificationSchema,
    totalViews: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Mongoose 9 stopped supporting the legacy callback-style hook signature
// (`function name(next) { ...; next(); }`) for pre-hooks -- even for plain
// synchronous ones like this. It no longer supplies a real `next` callback, so
// calling next() threw "next is not a function" on every single Hostel.create()/
// save(), identical in cause to the User.js password-hashing bug fixed earlier
// this session. A hook with no `next` parameter just needs to return normally
// (or return a Promise for async work) -- no explicit completion signal needed.
hostelSchema.pre("validate", function setSlugAndPoint() {
  if (!this.slug && this.name) {
    this.slug = slugifyText(`${this.name}-${this.area}-${this.city}`);
  }
  if (this.location?.lat && this.location?.lng) {
    this.location.coordinates = [this.location.lng, this.location.lat];
  }
});

hostelSchema.index({ groupId: 1 });
hostelSchema.index({ city: 1, type: 1 });
hostelSchema.index({ city: 1, status: 1, isVerified: 1 });
hostelSchema.index({ "location.coordinates": "2dsphere" });
hostelSchema.index({ slug: 1 });

module.exports = mongoose.model("Hostel", hostelSchema);
