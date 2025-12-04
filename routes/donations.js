const express = require("express");
const Donation = require("../models/Donation");
const { auth, requireRole } = require("../middleware/auth");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { getDistanceKm } = require("../utils/distance");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// helper: upload buffer to cloudinary
const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "food-donations" }, (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      })
      .end(fileBuffer);
  });
};

// 🔹 Donor: Post Donation
router.post(
  "/",
  auth,
  requireRole(["donor"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, type, quantityKg, bestBefore, lat, lng, address } =
        req.body;

      let imageUrl = "";
      if (req.file) {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      }

      const otp = Math.floor(1000 + Math.random() * 9000); // 4-digit

      const donation = await Donation.create({
        title,
        type,
        quantityKg,
        bestBefore,
        location: { lat, lng, address },
        imageUrl,
        donorId: req.user.id,
        otp,
      });

      res.json(donation);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔹 Donor: My donations list
router.get("/my", auth, requireRole(["donor"]), async (req, res) => {
  const list = await Donation.find({ donorId: req.user.id }).sort("-createdAt");
  res.json(list);
});

// 🔹 Volunteer: Nearby donations within radius (default 5 km)
router.get(
  "/nearby",
  auth,
  requireRole(["volunteer"]),
  async (req, res) => {
    try {
      const { lat, lng, radiusKm = 5 } = req.query;
      const allPending = await Donation.find({ status: "pending" });

      const now = new Date();

      const filtered = allPending
        .map((d) => {
          if (!d.location?.lat || !d.location?.lng) return null;

          const dist = getDistanceKm(
            Number(lat),
            Number(lng),
            d.location.lat,
            d.location.lng
          );
          const remainingMs = new Date(d.bestBefore) - now;
          return {
            ...d.toObject(),
            distanceKm: dist,
            expired: remainingMs <= 0,
            remainingMs,
          };
        })
        .filter(
          (d) => d && d.distanceKm <= radiusKm && d.expired === false
        );

      res.json(filtered);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔹 Volunteer: Accept / Claim donation (First-Come First-Serve)
router.post(
  "/:id/accept",
  auth,
  requireRole(["volunteer"]),
  async (req, res) => {
    try {
      const id = req.params.id;

      const doc = await Donation.findOneAndUpdate(
        { _id: id, status: "pending" },
        { status: "accepted", volunteerId: req.user.id },
        { new: true }
      );

      if (!doc)
        return res
          .status(400)
          .json({ message: "Already accepted by someone else" });

      res.json(doc);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔹 Volunteer: Mark Picked up (optional intermediate status)
router.post(
  "/:id/picked",
  auth,
  requireRole(["volunteer"]),
  async (req, res) => {
    const id = req.params.id;
    const donation = await Donation.findOneAndUpdate(
      { _id: id, volunteerId: req.user.id },
      { status: "picked" },
      { new: true }
    );
    res.json(donation);
  }
);

// 🔹 Volunteer: Verify OTP at handover & mark distributed
router.post(
  "/:id/verify-otp",
  auth,
  requireRole(["volunteer"]),
  async (req, res) => {
    try {
      const id = req.params.id;
      const { otp } = req.body;

      const donation = await Donation.findById(id);
      if (!donation) return res.status(404).json({ message: "Not found" });

      if (String(donation.otp) !== String(otp))
        return res.status(400).json({ message: "Wrong OTP" });

      donation.status = "completed";
      await donation.save();

      res.json({ message: "OTP verified, donation completed", donation });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔹 Volunteer: Upload proof image after distribution
router.post(
  "/:id/proof",
  auth,
  requireRole(["volunteer"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const id = req.params.id;
      let proofUrl = "";

      if (req.file) {
        proofUrl = await uploadToCloudinary(req.file.buffer);
      }

      const donation = await Donation.findOneAndUpdate(
        { _id: id, volunteerId: req.user.id },
        { proofImageUrl: proofUrl },
        { new: true }
      );

      res.json(donation);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔹 Safety: report spoiled food / no-show
router.post("/:id/report", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    const donation = await Donation.findById(id);
    if (!donation) return res.status(404).json({ message: "Not found" });

    donation.reports.push({ by: req.user.id, reason });
    await donation.save();

    res.json({ message: "Report submitted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
