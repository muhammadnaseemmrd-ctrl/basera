const mongoose = require("mongoose");

const jobLogSchema = new mongoose.Schema(
  {
    jobName: { type: String, required: true, index: true },
    startedAt: Date,
    completedAt: Date,
    processedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    notes: String,
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" }
  },
  { timestamps: true }
);

jobLogSchema.index({ jobName: 1, createdAt: -1 });

module.exports = mongoose.model("JobLog", jobLogSchema);
