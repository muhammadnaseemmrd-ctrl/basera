const mongoose = require("mongoose");

const walletLineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    source: String,
    amount: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    note: String,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    createdByName: String
  },
  { timestamps: true }
);

const studentWalletSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    studentRef: String,
    balance: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 },
    credits: [walletLineSchema],
    debits: [walletLineSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentWallet", studentWalletSchema);
