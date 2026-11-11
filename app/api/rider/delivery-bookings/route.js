import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import DeliveryBooking from "@/models/DeliveryBooking";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(request) {
  const riderId = new URL(request.url).searchParams.get("riderId");
  const access = await requireRole("rider", riderId);
  if (!access.authorized) return access.response;
  if (!riderId || !mongoose.isValidObjectId(riderId)) {
    return NextResponse.json(
      { success: false, message: "Select an active demo rider profile." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const rider = await Rider.findOne({ _id: riderId, status: "active" }).select("_id");
    if (!rider) {
      return NextResponse.json(
        { success: false, message: "The selected rider profile is not active." },
        { status: 403 }
      );
    }
    const bookings = await DeliveryBooking.find({
      "rider.userId": String(rider._id),
      "payment.status": "paid",
      status: { $in: ["assigned", "in_progress", "completed"] },
    })
      .select(
        "reference direction pickup delivery sender recipient parcel.category parcel.description parcel.declaredValue quote status assignedAt startedAt completedAt"
      )
      .sort({ reference: 1 })
      .lean();

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error("Could not load rider deliveries:", error);
    return NextResponse.json(
      { success: false, message: "Your deliveries are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The delivery update could not be read." },
      { status: 400 }
    );
  }

  const reference =
    typeof payload?.reference === "string" ? payload.reference.trim() : "";
  const riderId =
    typeof payload?.riderId === "string" ? payload.riderId.trim() : "";
  const action = payload?.action;
  if (
    !reference ||
    !riderId ||
    !mongoose.isValidObjectId(riderId) ||
    !["start", "complete"].includes(action)
  ) {
    return NextResponse.json(
      { success: false, message: "A valid delivery reference and action are required." },
      { status: 400 }
    );
  }

  const access = await requireRole("rider", riderId);
  if (!access.authorized) return access.response;

  try {
    const currentStatus = action === "start" ? "assigned" : "in_progress";
    const status = action === "start" ? "in_progress" : "completed";
    const timestamp = action === "start" ? "startedAt" : "completedAt";

    await connectDB();
    const rider = await Rider.findOne({ _id: riderId, status: "active" }).select("_id");
    if (!rider) {
      return NextResponse.json(
        { success: false, message: "The selected rider profile is not active." },
        { status: 403 }
      );
    }
    const booking = await DeliveryBooking.findOneAndUpdate(
      {
        reference,
        "rider.userId": String(rider._id),
        "payment.status": "paid",
        status: currentStatus,
      },
      { $set: { status, [timestamp]: new Date() } },
      { new: true }
    )
      .select("reference status rider assignedAt startedAt completedAt")
      .lean();

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "This delivery is not in the required status or is assigned to another rider." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("Could not update rider delivery:", error);
    return NextResponse.json(
      { success: false, message: "We couldn't update this delivery. Please try again." },
      { status: 500 }
    );
  }
}
