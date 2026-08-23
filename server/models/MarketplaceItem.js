const mongoose = require("mongoose");

const marketplaceItemSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sellerName: String,
    city: String,
    university: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelName: String,
    title: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, enum: ["books", "furniture", "electronics", "bedding", "kitchen", "other"], default: "other" },
    price: { type: Number, default: 0 },
    condition: { type: String, enum: ["new", "like_new", "good", "used"], default: "good" },
    images: [String],
    status: { type: String, enum: ["active", "reserved", "sold", "hidden"], default: "active" }
  },
  { timestamps: true }
);

marketplaceItemSchema.index({ status: 1, city: 1, university: 1, createdAt: -1 });

module.exports = mongoose.model("MarketplaceItem", marketplaceItemSchema);
