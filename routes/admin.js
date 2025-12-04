const express = require("express");
const { auth, requireRole } = require("../middleware/auth");
const Donation = require("../models/Donation");
const User = require("../models/User");

const router = express.Router();

// Admin: stats & impact dashboard
router.get("/stats", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const all = await Donation.find();

    const totalDonations = all.length;
    const completed = all.filter((d) => d.status === "completed");
    const active = all.filter((d) =>
      ["pending", "accepted", "picked"].includes(d.status)
    );

    const totalKg = completed.reduce((sum, d) => sum + (d.quantityKg || 0), 0);
    const mealsSaved = totalKg * 4; // as per problem statement

    res.json({
      totalDonations,
      completedCount: completed.length,
      activeCount: active.length,
      totalKg,
      mealsSaved,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: list active donations (for map / monitoring)
router.get("/active-donations", auth, requireRole(["admin"]), async (req, res) => {
  const active = await Donation.find({
    status: { $in: ["pending", "accepted", "picked"] },
  });
  res.json(active);
});

// Admin: verify NGO / volunteer
router.post("/verify-user/:id", auth, requireRole(["admin"]), async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndUpdate(
    id,
    { verifiedNGO: true },
    { new: true }
  );
  res.json(user);
});

module.exports = router;
