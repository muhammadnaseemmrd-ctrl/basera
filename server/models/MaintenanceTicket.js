const mongoose = require("mongoose");

const ticketUpdateSchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    byName: String,
    byRole: String,
    status: String,
    note: String,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const maintenanceTicketSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["plumbing", "electricity", "wifi", "cleaning", "food", "security", "furniture", "other"],
      default: "other"
    },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    status: { type: String, enum: ["open", "assigned", "in_progress", "resolved", "closed", "escalated"], default: "open" },
    evidence: [String],
    slaDueAt: Date,
    assignedTo: String,
    satisfaction: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      submittedAt: Date
    },
    updates: [ticketUpdateSchema]
  },
  { timestamps: true }
);

maintenanceTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
maintenanceTicketSchema.index({ student: 1, createdAt: -1 });
maintenanceTicketSchema.index({ host: 1, createdAt: -1 });

module.exports = mongoose.model("MaintenanceTicket", maintenanceTicketSchema);
