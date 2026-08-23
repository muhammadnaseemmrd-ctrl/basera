const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["SEASONAL", "CITY", "ROOM_TYPE", "COUPON_CODE", "HOST_FUNDED", "LOYALTY", "EARLY_BIRD", "LAST_MINUTE"],
      required: true
    },
    valueType: { type: String, enum: ["PERCENTAGE", "FLAT_PKR"], required: true },
    value: { type: Number, required: true },
    appliesTo: {
      cities: [String],
      roomTypes: [String]
    },
    couponCode: { type: String, uppercase: true, trim: true },
    validFrom: Date,
    validTo: Date,
    usageLimit: Number,
    usageCount: { type: Number, default: 0 },
    canStack: { type: Boolean, default: false },
    fundedBy: { type: String, enum: ["BASERA", "HOST"], default: "BASERA" },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["ACTIVE", "PAUSED", "SCHEDULED", "EXPIRED"], default: "ACTIVE" }
  },
  { timestamps: true }
);

discountSchema.index({ status: 1, validFrom: 1, validTo: 1 });
discountSchema.index({ couponCode: 1 });

module.exports = mongoose.model("Discount", discountSchema);
