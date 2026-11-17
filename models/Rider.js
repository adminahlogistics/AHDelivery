import mongoose from "mongoose";

const encryptedValueSchema = new mongoose.Schema(
  {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: Buffer, required: true },
  },
  { _id: false }
);

const encryptedDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, maxlength: 120 },
    contentType: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: Buffer, required: true },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "declined"],
      default: "pending",
      required: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false }
);

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
    address: { type: encryptedValueSchema, default: undefined },
    bvn: { type: encryptedValueSchema, default: undefined },
    nin: { type: encryptedValueSchema, default: undefined },
    proofOfAddress: { type: encryptedDocumentSchema, default: undefined },
    ninSlip: { type: encryptedDocumentSchema, default: undefined },
    addressProvided: { type: Boolean, default: false },
    bvnProvided: { type: Boolean, default: false },
    ninProvided: { type: Boolean, default: false },
    proofOfAddressProvided: { type: Boolean, default: false },
    ninSlipProvided: { type: Boolean, default: false },
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
