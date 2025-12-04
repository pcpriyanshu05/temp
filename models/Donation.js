const mongoose = require("mongoose");

const DonationSchema = new mongoose.Schema(
  {
    title: String,
    type: String, // veg / non-veg / cooked
    quantityKg: Number,
    bestBefore: Date,
    imageUrl: String,        // food photo
    proofImageUrl: String,   // distribution proof
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "picked", "completed"],
      default: "pending",
    },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    otp: Number,
    reports: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donation", DonationSchema);
