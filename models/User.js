const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["donor", "volunteer", "admin"], required: true },
  location: {
    lat: Number,
    lng: Number,
  },
  verifiedNGO: { type: Boolean, default: false }, // for NGOs / volunteers
});

module.exports = mongoose.model("User", UserSchema);
