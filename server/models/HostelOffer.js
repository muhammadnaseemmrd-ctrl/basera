const mongoose = require("mongoose");

// Hostel-operations offers (invoice-level). Deliberately separate from the marketplace
// `Discount` model, which prices booking checkout (see docs/06a-design-note.md D9).
const hostelOfferSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    scope: { type: String, enum: ["hostel", "block"], default: "hostel" },
    blocks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Block" }],
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true },
    type: { type: String, enum: ["percent", "flat", "free_days"], required: true },
    value: { type: Number, required: true, min: 1 },
    // "rent" | "all_fees" | ["mess", "utilities", ...]
    appliesTo: { type: mongoose.Schema.Types.Mixed, default: "rent" },
    trigger: { type: String, enum: ["manual", "early_payment", "advance_months", "long_stay", "referral", "sibling", "scholarship", "coupon"], default: "manual" },
    condition: { payBeforeDay: Number, minAdvanceMonths: Number, minStayMonths: Number },
    validFrom: Date,
    validTo: Date,
    maxRedemptions: { type: Number, default: null },
    perStudentLimit: { type: Number, default: null },
    stackable: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "active", "paused", "expired"], default: "draft" },
    // applied + pending-approval redemptions; moved atomically so caps can't be overshot
    redemptionCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

hostelOfferSchema.index({ hostel: 1, status: 1 });
hostelOfferSchema.index({ hostel: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } });

module.exports = mongoose.model("HostelOffer", hostelOfferSchema);
