import { randomBytes } from "node:crypto";
import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import { PARCEL_CATEGORIES } from "@/config/parcelCategories";
import DeliveryBooking from "@/models/DeliveryBooking";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEMO_FARE_NGN = 5500;

const readText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const isValidPhone = (value) => /^\+?[0-9\s()-]{7,30}$/.test(value);

export async function GET() {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const bookings = await DeliveryBooking.find({
      "payment.status": "paid",
      status: {
        $in: ["paid", "pending", "assigned", "in_progress", "completed"],
      },
    })
      .select(
        "reference direction pickup delivery sender recipient parcel.category parcel.description parcel.declaredValue parcel.acceptedParcelRequirements quote payment status rider assignedAt startedAt completedAt createdAt"
      )
      .sort({ reference: 1 })
      .lean();

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error("Could not load delivery requests:", error);
    return NextResponse.json(
      { success: false, message: "Delivery requests are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The order update could not be read." },
      { status: 400 }
    );
  }

  const reference = readText(payload?.reference, 40);
  const action = payload?.action;
  if (!reference || !["assign", "start", "complete"].includes(action)) {
    return NextResponse.json(
      { success: false, message: "A valid order reference and action are required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    if (action === "assign") {
      const riderId = readText(payload?.riderId, 80);
      if (!riderId) {
        return NextResponse.json(
          { success: false, message: "Select a rider to assign this order." },
          { status: 400 }
        );
      }

      const rider = await Rider.findOne({
        _id: riderId,
        status: "active",
      }).lean();
      if (!rider) {
        return NextResponse.json(
          { success: false, message: "The selected account is not an active rider." },
          { status: 400 }
        );
      }

      const booking = await DeliveryBooking.findOneAndUpdate(
        {
          reference,
          "payment.status": "paid",
          status: { $in: ["paid", "pending", "assigned"] },
        },
        {
          $set: {
            rider: {
              userId: String(rider._id),
              name: rider.name,
              phone: rider.phone || "",
            },
            status: "assigned",
            assignedAt: new Date(),
          },
          $unset: { startedAt: 1, completedAt: 1 },
        },
        { new: true }
      )
        .select("reference status rider assignedAt")
        .lean();

      if (!booking) {
        return NextResponse.json(
          { success: false, message: "This order can no longer be assigned." },
          { status: 409 }
        );
      }

      return NextResponse.json({ success: true, booking });
    }

    const targetStatus = action === "start" ? "in_progress" : "completed";
    const currentStatus = action === "start" ? "assigned" : "in_progress";
    const timestampField = action === "start" ? "startedAt" : "completedAt";
    const booking = await DeliveryBooking.findOneAndUpdate(
      {
        reference,
        "payment.status": "paid",
        status: currentStatus,
      },
      { $set: { status: targetStatus, [timestampField]: new Date() } },
      { new: true }
    )
      .select("reference status rider assignedAt startedAt completedAt")
      .lean();

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "This order is not in the required status." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("Could not update delivery order:", error);
    return NextResponse.json(
      { success: false, message: "We couldn't update this order. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The booking details could not be read." },
      { status: 400 }
    );
  }

  const idempotencyKey = readText(payload?.idempotencyKey, 80);
  const direction = payload?.direction;
  const pickupAddress = readText(payload?.pickupAddress, 240);
  const deliveryAddress = readText(payload?.deliveryAddress, 240);
  const senderName = readText(payload?.sender?.name, 100);
  const senderPhone = readText(payload?.sender?.phone, 30);
  const recipientName = readText(payload?.recipient?.name, 100);
  const recipientPhone = readText(payload?.recipient?.phone, 30);
  const parcelCategory = readText(payload?.parcel?.category, 80);
  const parcelDescription = readText(payload?.parcel?.description, 300);
  const declaredValue = Number(payload?.parcel?.declaredValue || 0);
  const bookingOwnerId = `guest:${idempotencyKey}`;

  if (
    !idempotencyKey ||
    !["send", "receive"].includes(direction) ||
    pickupAddress.length < 5 ||
    deliveryAddress.length < 5 ||
    !senderName ||
    !isValidPhone(senderPhone) ||
    !recipientName ||
    !isValidPhone(recipientPhone) ||
    !PARCEL_CATEGORIES.includes(parcelCategory) ||
    (parcelCategory === "Other" && !parcelDescription) ||
    !Number.isFinite(declaredValue) ||
    !Number.isInteger(declaredValue) ||
    declaredValue < 0 ||
    declaredValue > 45000 ||
    payload?.parcel?.acceptedParcelRequirements !== true
  ) {
    return NextResponse.json(
      { success: false, message: "Complete all required delivery details." },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const existingBooking = await DeliveryBooking.findOne({
      userId: bookingOwnerId,
      idempotencyKey,
    }).lean();
    if (existingBooking) {
      return NextResponse.json({
        success: true,
        booking: {
          reference: existingBooking.reference,
          status: existingBooking.status,
          quote: existingBooking.quote,
          paymentStatus: existingBooking.payment.status,
        },
        reused: true,
      });
    }

    const reference = `AH-${randomBytes(4).toString("hex").toUpperCase()}`;
    const paymentReference = `delivery_${reference}`;
    const booking = await DeliveryBooking.create({
      reference,
      idempotencyKey,
      userId: bookingOwnerId,
      direction,
      pickup: { address: pickupAddress },
      delivery: { address: deliveryAddress },
      sender: { name: senderName, phone: senderPhone },
      recipient: { name: recipientName, phone: recipientPhone },
      parcel: {
        category: parcelCategory,
        ...(parcelDescription ? { description: parcelDescription } : {}),
        declaredValue,
        acceptedParcelRequirements: true,
      },
      vehicleType: "motorbike",
      quote: { amount: DEMO_FARE_NGN, currency: "NGN", isDemo: true },
      payment: {
        method: "demo",
        status: "pending",
        reference: paymentReference,
      },
      status: "pending_payment",
      source: "web",
    });

    return NextResponse.json(
      {
        success: true,
        booking: {
          reference: booking.reference,
          status: booking.status,
          quote: booking.quote,
          paymentStatus: booking.payment.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const existingBooking = await DeliveryBooking.findOne({
          userId: bookingOwnerId,
          idempotencyKey,
        }).lean();
        if (existingBooking) {
          return NextResponse.json({
            success: true,
            booking: {
              reference: existingBooking.reference,
              status: existingBooking.status,
              quote: existingBooking.quote,
              paymentStatus: existingBooking.payment.status,
            },
            reused: true,
          });
        }
      } catch (lookupError) {
        console.error("Could not retrieve the existing delivery request:", lookupError);
        return NextResponse.json(
          { success: false, message: "We couldn't confirm your saved request. Please try again." },
          { status: 500 }
        );
      }
    }

    console.error("Could not save delivery request:", error);
    return NextResponse.json(
      { success: false, message: "We couldn't save your delivery request. Please try again." },
      { status: 500 }
    );
  }
}
