const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostProperty: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    listedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    roomNumber: { type: String, required: true },
    title: String,
    city: String,
    area: String,
    address: String,
    landmark: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }
    },
    type: { type: String, enum: ["single", "double", "triple", "quad", "dorm", "pg", "studio", "floor"], required: true },
    roomType: {
      type: String,
      enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "BUNK_DORM", "SEMI_PRIVATE", "PG", "STUDIO", "ENTIRE_FLOOR"],
      default: "DOUBLE"
    },
    listingCategory: {
      type: String,
      enum: ["HOSTEL_ROOM", "PRIVATE_ROOM", "PG_ACCOMMODATION", "SHARED_ROOM", "ENTIRE_FLOOR"],
      default: "HOSTEL_ROOM"
    },
    totalBeds: { type: Number, required: true },
    availableBeds: { type: Number, required: true },
    pricePerBed: { type: Number, required: true },
    pricePerHead: Number,
    pricePerRoom: Number,
    securityDeposit: { type: Number, default: 5000 },
    pricePerSemester: Number,
    mealPlan: {
      type: String,
      enum: ["NONE", "BREAKFAST", "TWO_MEALS", "FULL_BOARD", "KITCHEN_ACCESS"],
      default: "FULL_BOARD"
    },
    mealCost: { type: Number, default: 0 },
    genderPolicy: {
      type: String,
      enum: ["BOYS_ONLY", "GIRLS_ONLY", "CO_ED", "FAMILIES", "PROFESSIONALS"],
      default: "BOYS_ONLY"
    },
    curfewTime: String,
    facilities: [String],
    amenities: [String],
    images: [String],
    photos: [String],
    // Perceptual (or fallback) hashes computed by server/services/imageHashService.js
    // for each photo in `images`/`photos`, used to flag likely duplicate/stolen
    // listing photos re-used across different hosts. See roomRoutes.js.
    imageHashes: [String],
    videoTour: String,
    virtualTourUrl: String,
    panoramaUrl: String,
    description: String,
    descriptionUrdu: String,
    floor: Number,
    floorNumber: Number,
    nearestUniversity: String,
    distanceToUniversity: Number,
    instantBooking: { type: Boolean, default: false },
    trialStayAvailable: { type: Boolean, default: false },
    rules: {
      smoking: { type: Boolean, default: false },
      pets: { type: Boolean, default: false },
      guests: { type: Boolean, default: false },
      studentsOnly: { type: Boolean, default: true }
    },
    waitlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["PENDING_REVIEW", "ACTIVE", "PAUSED", "FULL", "REJECTED", "ARCHIVED"], default: "ACTIVE" },
    isAvailable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Found during live QA: `location` has a 2dsphere index, and its `type` sub-field
// carries a default of "Point". When a room is created without coordinates,
// roomRoutes.js sets `location: undefined` on the payload, but Mongoose still
// initializes the nested subdocument's own defaults regardless (the parent key
// being absent doesn't stop a child path's `default` from firing), producing a
// half-populated `{ type: "Point" }` with no `coordinates` array. MongoDB's
// 2dsphere index then rejects the insert at the driver level with "Can't extract
// geo keys ... Point must be an array or object, instead got type missing" --
// this blocked EVERY room creation that didn't supply exact lat/lng, which is a
// production-blocking bug (most host listing forms will not always have precise
// coordinates on hand). Fix: whenever `location.coordinates` isn't a valid
// 2-element numeric array, force `location` fully undefined so the field is
// omitted from the document entirely (valid for a 2dsphere index) rather than
// left as invalid partial GeoJSON. See Hostel.js/User.js for why this hook has
// no `next` parameter under Mongoose 9.
roomSchema.pre("validate", function ensureValidGeoLocation() {
  const coords = this.location?.coordinates;
  const isValidPoint = Array.isArray(coords) && coords.length === 2 && coords.every((value) => typeof value === "number" && !Number.isNaN(value));
  if (!isValidPoint) {
    this.location = undefined;
  }
});

roomSchema.index({ hostel: 1, type: 1 });
roomSchema.index({ blockId: 1 });
roomSchema.index({ city: 1, roomType: 1, genderPolicy: 1, pricePerHead: 1 });
roomSchema.index({ city: 1, roomType: 1, genderPolicy: 1, pricePerHead: 1, availableBeds: 1, status: 1 });
roomSchema.index({ listedBy: 1, status: 1 });
roomSchema.index({ hostel: 1, status: 1, availableBeds: 1 });
roomSchema.index({ listingCategory: 1, status: 1 });
roomSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Room", roomSchema);
