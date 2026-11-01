const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    blocks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Block" }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    cnic: { type: String, trim: true },
    role: { type: String, enum: ["warden", "assistant_warden", "manager", "accountant", "cook", "guard", "cleaner", "maintenance", "other"], default: "warden" },
    status: { type: String, enum: ["active", "suspended", "terminated"], default: "active" },
    joinedAt: { type: Date, default: Date.now },
    suspendedAt: Date,
    suspensionReason: String,
    terminatedAt: Date,
    terminationReason: String,
    terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    terminationNotice: { type: mongoose.Schema.Types.ObjectId, ref: "Notice" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

staffSchema.index({ hostel: 1, status: 1 });
staffSchema.index({ user: 1, status: 1 });
staffSchema.index({ blocks: 1 });

module.exports = mongoose.model("StaffMember", staffSchema);
