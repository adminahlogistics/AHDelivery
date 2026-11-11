import mongoose from "mongoose";

const riderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive"],
      required: true,
    },
  },
  { timestamps: true, collection: "riders" }
);

const Rider = mongoose.models.rider || mongoose.model("rider", riderSchema);

export default Rider;
