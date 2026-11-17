import mongoose from "mongoose";
import { PARCEL_CATEGORIES } from "@/config/parcelCategories";

const addressSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
  },
  { _id: false }
);

const riderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false }
);

const riderAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 30 },
    leg: {
      type: String,
      enum: ["direct", "to_hub", "final_delivery"],
      required: true,
    },
    assignedAt: { type: Date, required: true },
  },
  { _id: false }
);

const riderDistanceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    leg: {
      type: String,
      enum: ["direct", "to_hub", "final_delivery"],
      required: true,
    },
    distanceKm: { type: Number, required: true, min: 0, max: 1000 },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const deliveryBookingSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    batchReference: { type: String, index: true },
    batchIndex: { type: Number, min: 0 },
    batchSize: { type: Number, min: 1, max: 20 },
    idempotencyKey: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    direction: { type: String, enum: ["send", "receive"], required: true },
    pickup: { type: addressSchema, required: true },
    delivery: { type: addressSchema, required: true },
    sender: { type: contactSchema, required: true },
    recipient: { type: contactSchema, required: true },
    deliveryType: {
      type: String,
      enum: ["direct", "hub"],
      default: "direct",
      required: true,
    },
    hubLocation: {
      type: String,
      enum: ["yaba", "oshodi", "island"],
    },
    hubAddress: { type: String, trim: true, maxlength: 240 },
    currentLeg: {
      type: String,
      enum: ["direct", "to_hub", "final_delivery"],
      default: "direct",
      required: true,
    },
    rider: { type: riderSchema, default: undefined },
    riderAssignmentHistory: {
      type: [riderAssignmentSchema],
      default: [],
    },
    riderDistanceHistory: {
      type: [riderDistanceSchema],
      default: [],
    },
    assignedAt: { type: Date },
    startedAt: { type: Date },
    hubReceivedAt: { type: Date },
    completedAt: { type: Date },
    parcel: {
      category: { type: String, enum: PARCEL_CATEGORIES, required: true },
      description: { type: String, trim: true, maxlength: 300 },
      declaredValue: { type: Number, min: 0, max: 45000, default: 0 },
      acceptedParcelRequirements: { type: Boolean, required: true },
    },
    vehicleType: {
      type: String,
      enum: ["motorbike"],
      required: true,
      default: "motorbike",
    },
    quote: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true, default: "NGN" },
      isDemo: { type: Boolean, required: true, default: true },
    },
    payment: {
      responsibility: {
        type: String,
        enum: ["sender", "recipient"],
        default: "sender",
        required: true,
      },
      method: { type: String, enum: ["cashless", "demo", "cash"], required: true },
      status: {
        type: String,
        enum: [
          "not_started",
          "pending",
          "paid",
          "due_on_delivery",
          "collected",
          "failed",
        ],
        required: true,
        default: "not_started",
      },
      reference: { type: String, required: true },
      collectedAt: { type: Date },
    },
    status: {
      type: String,
      enum: [
        "quote_requested",
        "pending_payment",
        "paid",
        "pending",
        "assigned",
        "in_progress",
        "in_transit",
        "at_hub",
        "completed",
        "cancelled",
      ],
      required: true,
      default: "quote_requested",
    },
    source: { type: String, enum: ["web"], default: "web" },
  },
  { timestamps: true, collection: "deliverybookings" }
);

deliveryBookingSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);
deliveryBookingSchema.index({ batchReference: 1, batchIndex: 1 });

const DeliveryBooking =
  mongoose.models.deliveryBooking ||
  mongoose.model("deliveryBooking", deliveryBookingSchema);

export default DeliveryBooking;
