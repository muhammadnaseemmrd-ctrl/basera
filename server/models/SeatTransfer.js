const mongoose = require("mongoose");

const seatTransferSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    fromRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    fromBed: { type: Number, required: true },
    fromBlock: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    toRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    toBed: { type: Number, required: true },
    toBlock: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    reason: { type: String, trim: true, maxlength: 500 },
    // optional new monthly rent from the move date (open invoices keep their amounts)
    newMonthlyRent: Number,
    status: { type: String, enum: ["requested", "approved", "rejected", "cancelled"], default: "requested" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedByRole: String,
    requestedAt: Date,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decisionNote: String,
    decidedAt: Date
  },
  { timestamps: true }
);

seatTransferSchema.index({ hostel: 1, status: 1, createdAt: -1 });
// one open transfer request per stay
seatTransferSchema.index({ booking: 1 }, { unique: true, partialFilterExpression: { status: "requested" } });

module.exports = mongoose.model("SeatTransfer", seatTransferSchema);
