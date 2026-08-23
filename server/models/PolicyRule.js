const mongoose = require("mongoose");

const policyRuleSchema = new mongoose.Schema(
  {
    ruleKey: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: String,
    conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
    actions: { type: mongoose.Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true },
    severity: { type: String, default: "medium" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedByName: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("PolicyRule", policyRuleSchema);
