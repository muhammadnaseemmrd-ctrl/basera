const mongoose = require("mongoose");

const hostelExpenseSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    category: { type: String, enum: ["salaries", "utilities", "maintenance", "food", "supplies", "rent", "taxes", "marketing", "other"], required: true },
    amount: { type: Number, required: true, min: 1 },
    spentOn: { type: Date, required: true },
    note: { type: String, required: true, trim: true, maxlength: 500 },
    receiptUrl: String,
    status: { type: String, enum: ["active", "void"], default: "active" },
    voidReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

hostelExpenseSchema.index({ hostel: 1, status: 1, spentOn: -1 });

module.exports = mongoose.model("HostelExpense", hostelExpenseSchema);
