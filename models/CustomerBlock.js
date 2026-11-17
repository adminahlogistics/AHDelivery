import mongoose from "mongoose";

const customerBlockSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    displayPhone: { type: String, required: true },
    blockedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: "customerblocks" }
);

const CustomerBlock =
  mongoose.models.customerBlock ||
  mongoose.model("customerBlock", customerBlockSchema);

export default CustomerBlock;
