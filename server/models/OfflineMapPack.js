const mongoose = require("mongoose");

const offlineMapPackSchema = new mongoose.Schema(
  {
    universityId: { type: String, required: true, index: true },
    universityName: String,
    city: String,
    bbox: [Number],
    tileVersion: { type: String, default: "osm-v1" },
    tileTemplates: [String],
    pois: [mongoose.Schema.Types.Mixed],
    sizeEstimateMb: { type: Number, default: 12 },
    expiresAt: { type: Date, index: { expires: 0 } }
  },
  { timestamps: true }
);

module.exports = mongoose.model("OfflineMapPack", offlineMapPackSchema);
