import { createHash, randomBytes } from "node:crypto";
import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import { DELIVERY_HUBS } from "@/config/deliveryHubs";
import { PARCEL_CATEGORIES } from "@/config/parcelCategories";
import { normalizeCustomerPhone } from "@/lib/customerIdentity";
import CustomerBlock from "@/models/CustomerBlock";
import DeliveryBooking from "@/models/DeliveryBooking";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEMO_FARE_NGN = 5000;
const DISPATCHABLE_PAYMENT_STATUSES = ["paid", "due_on_delivery", "collected"];
const MAX_BATCH_SIZE = 20;

const readText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const isValidPhone = (value) => /^\+?[0-9\s()-]{7,30}$/.test(value);

export async function GET() {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const bookings = await DeliveryBooking.find({
      status: {
        $in: [
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
      },
    })
      .select(
        "reference batchReference batchIndex batchSize direction pickup delivery sender recipient parcel.category parcel.description parcel.declaredValue parcel.acceptedParcelRequirements quote payment status deliveryType hubLocation hubAddress currentLeg rider riderAssignmentHistory assignedAt startedAt hubReceivedAt completedAt createdAt"
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
  const distanceKm = payload?.distanceKm;
  if (
    !reference ||
    !["set_delivery_type", "assign", "start", "arrive_hub", "complete"].includes(action) ||
    (action === "complete" &&
      (typeof distanceKm !== "number" ||
        !Number.isFinite(distanceKm) ||
        distanceKm < 0 ||
        distanceKm > 1000))
  ) {
    return NextResponse.json(
      { success: false, message: "A valid order reference and action are required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    if (action === "set_delivery_type") {
      const deliveryType = payload?.deliveryType;
      const hubLocation = payload?.hubLocation;
      if (
        !["direct", "hub"].includes(deliveryType) ||
        (deliveryType === "hub" &&
          !DELIVERY_HUBS.some((hub) => hub.value === hubLocation))
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Choose direct delivery or select a valid hub location for hub sorting.",
          },
          { status: 400 }
        );
      }

      const update = {
        $set: {
          deliveryType,
          currentLeg: deliveryType === "hub" ? "to_hub" : "direct",
        },
      };
      if (deliveryType === "hub") {
        update.$set.hubLocation = hubLocation;
        update.$unset = { hubAddress: 1 };
      } else {
        update.$unset = { hubLocation: 1, hubAddress: 1 };
      }

      const booking = await DeliveryBooking.findOneAndUpdate(
        {
          reference,
          "payment.status": { $in: DISPATCHABLE_PAYMENT_STATUSES },
          status: { $in: ["paid", "pending"] },
        },
        update,
        { new: true, runValidators: true }
      )
        .select("reference status deliveryType hubLocation hubAddress currentLeg")
        .lean();

      if (!booking) {
        return NextResponse.json(
          { success: false, message: "Delivery route can only be changed on a pending order." },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, booking });
    }

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

      const currentBooking = await DeliveryBooking.findOne({
        reference,
        "payment.status": { $in: DISPATCHABLE_PAYMENT_STATUSES },
        status: { $in: ["paid", "pending", "assigned", "in_progress", "in_transit", "at_hub"] },
      })
        .select("_id status deliveryType hubLocation hubAddress currentLeg")
        .lean();
      if (!currentBooking) {
        return NextResponse.json(
          { success: false, message: "This order can no longer be assigned." },
          { status: 409 }
        );
      }

      const assignmentTime = new Date();
      const activeLeg =
        currentBooking.status === "at_hub"
          ? "final_delivery"
          : currentBooking.currentLeg ||
            (currentBooking.deliveryType === "hub" ? "to_hub" : "direct");
      if (
        activeLeg === "to_hub" &&
        !currentBooking.hubLocation &&
        !currentBooking.hubAddress
      ) {
        return NextResponse.json(
          { success: false, message: "Select a hub location before assigning this delivery." },
          { status: 409 }
        );
      }

      const booking = await DeliveryBooking.findOneAndUpdate(
        {
          _id: currentBooking._id,
          "payment.status": { $in: DISPATCHABLE_PAYMENT_STATUSES },
          status: currentBooking.status,
        },
        {
          $set: {
            rider: {
              userId: String(rider._id),
              name: rider.name,
              phone: rider.phone || "",
            },
            currentLeg: activeLeg,
            status: "assigned",
            assignedAt: assignmentTime,
          },
          $push: {
            riderAssignmentHistory: {
              userId: String(rider._id),
              name: rider.name,
              phone: rider.phone || "",
              leg: activeLeg,
              assignedAt: assignmentTime,
            },
          },
          $unset: { startedAt: 1, completedAt: 1 },
        },
        { new: true }
      )
        .select(
          "reference status deliveryType hubLocation hubAddress currentLeg rider riderAssignmentHistory assignedAt startedAt"
        )
        .lean();

      if (!booking) {
        return NextResponse.json(
          { success: false, message: "This order can no longer be assigned." },
          { status: 409 }
        );
      }

      return NextResponse.json({ success: true, booking });
    }

    if (action === "start") {
      const booking = await DeliveryBooking.findOneAndUpdate(
        {
          reference,
          "payment.status": { $in: DISPATCHABLE_PAYMENT_STATUSES },
          status: "assigned",
        },
        { $set: { status: "in_transit", startedAt: new Date() } },
        { new: true }
      )
        .select("reference status deliveryType hubLocation hubAddress currentLeg rider assignedAt startedAt")
        .lean();

      if (!booking) {
        return NextResponse.json(
          { success: false, message: "This order is not assigned and ready to start." },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, booking });
    }

    const arrivingAtHub = action === "arrive_hub";
    const updateFilter = {
      reference,
      "payment.status": arrivingAtHub
        ? { $in: DISPATCHABLE_PAYMENT_STATUSES }
        : { $in: ["paid", "collected"] },
      status: { $in: ["in_transit", "in_progress"] },
    };
    let update = arrivingAtHub
      ? {
          $set: { status: "at_hub", hubReceivedAt: new Date() },
          $unset: { startedAt: 1 },
        }
      : { $set: { status: "completed", completedAt: new Date() } };
    updateFilter.currentLeg = arrivingAtHub
      ? "to_hub"
      : { $in: ["direct", "final_delivery", null] };
    if (!arrivingAtHub) {
      const activeBooking = await DeliveryBooking.findOne(updateFilter)
        .select("currentLeg deliveryType rider")
        .lean();
      if (!activeBooking?.rider?.userId || !activeBooking.rider.name) {
        return NextResponse.json(
          { success: false, message: "Assign a rider before recording the completed trip." },
          { status: 409 }
        );
      }
      update.$push = {
        riderDistanceHistory: {
          userId: activeBooking.rider.userId,
          name: activeBooking.rider.name,
          leg:
            activeBooking.currentLeg ||
            (activeBooking.deliveryType === "hub" ? "final_delivery" : "direct"),
          distanceKm,
          recordedAt: new Date(),
        },
      };
    }
    const booking = await DeliveryBooking.findOneAndUpdate(
      updateFilter,
      update,
      { new: true }
    )
      .select(
        "reference status deliveryType hubLocation hubAddress currentLeg rider riderDistanceHistory assignedAt startedAt hubReceivedAt completedAt"
      )
      .lean();

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message: arrivingAtHub
            ? "Only a delivery currently in transit to the hub can be marked received."
            : "Only a direct or final delivery in transit can be marked completed.",
        },
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
  const senderName = readText(payload?.sender?.name, 100);
  const senderPhone = readText(payload?.sender?.phone, 30);
  const rawDeliveries = Array.isArray(payload?.deliveries)
    ? payload.deliveries
    : [
        {
          deliveryAddress: payload?.deliveryAddress,
          recipient: payload?.recipient,
          parcel: payload?.parcel,
          paymentResponsibility: "sender",
        },
      ];
  const bookingOwnerId = `guest:${idempotencyKey}`;
  const deliveries = rawDeliveries.map((delivery) => ({
    deliveryAddress: readText(delivery?.deliveryAddress, 240),
    recipientName: readText(delivery?.recipient?.name, 100),
    recipientPhone: readText(delivery?.recipient?.phone, 30),
    parcelCategory: readText(delivery?.parcel?.category, 80),
    parcelDescription: readText(delivery?.parcel?.description, 300),
    declaredValue: Number(delivery?.parcel?.declaredValue || 0),
    acceptedParcelRequirements:
      delivery?.parcel?.acceptedParcelRequirements === true,
    paymentResponsibility: delivery?.paymentResponsibility,
  }));

  if (
    !idempotencyKey ||
    !["send", "receive"].includes(direction) ||
    pickupAddress.length < 5 ||
    !senderName ||
    !isValidPhone(senderPhone) ||
    deliveries.length < 1 ||
    deliveries.length > MAX_BATCH_SIZE ||
    deliveries.some(
      (delivery) =>
        delivery.deliveryAddress.length < 5 ||
        !delivery.recipientName ||
        !isValidPhone(delivery.recipientPhone) ||
        !PARCEL_CATEGORIES.includes(delivery.parcelCategory) ||
        (delivery.parcelCategory === "Other" && !delivery.parcelDescription) ||
        !Number.isFinite(delivery.declaredValue) ||
        !Number.isInteger(delivery.declaredValue) ||
        delivery.declaredValue < 0 ||
        delivery.declaredValue > 45000 ||
        !delivery.acceptedParcelRequirements ||
        !["sender", "recipient"].includes(delivery.paymentResponsibility)
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Complete the sender details and check every delivery, parcel, and payment choice.",
      },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const batchReference = `AHB-${createHash("sha256")
      .update(`${bookingOwnerId}:${idempotencyKey}`)
      .digest("hex")
      .slice(0, 16)
      .toUpperCase()}`;
    const existingBatch = await DeliveryBooking.find({ batchReference })
      .select("batchSize")
      .lean();
    if (existingBatch.some((booking) => booking.batchSize !== deliveries.length)) {
      return NextResponse.json(
        {
          success: false,
          message: "This order reference was already used for a different number of deliveries.",
        },
        { status: 409 }
      );
    }

    if (!existingBatch.length) {
      const blockedCustomer = await CustomerBlock.exists({
        phone: normalizeCustomerPhone(senderPhone),
      });
      if (blockedCustomer) {
        return NextResponse.json(
          {
            success: false,
            message:
              "We’re unable to accept a booking from this phone number. Please contact customer support.",
          },
          { status: 403 }
        );
      }
    }

    for (const [index, delivery] of deliveries.entries()) {
      const deliveryIdempotencyKey = `${idempotencyKey}:${index}`;
      const paysNow = delivery.paymentResponsibility === "sender";
      const reference = `AH-${randomBytes(4).toString("hex").toUpperCase()}`;
      try {
        await DeliveryBooking.findOneAndUpdate(
          { userId: bookingOwnerId, idempotencyKey: deliveryIdempotencyKey },
          {
            $setOnInsert: {
              reference,
              batchReference,
              batchIndex: index,
              batchSize: deliveries.length,
              idempotencyKey: deliveryIdempotencyKey,
              userId: bookingOwnerId,
              direction,
              pickup: { address: pickupAddress },
              delivery: { address: delivery.deliveryAddress },
              sender: { name: senderName, phone: senderPhone },
              recipient: {
                name: delivery.recipientName,
                phone: delivery.recipientPhone,
              },
              parcel: {
                category: delivery.parcelCategory,
                ...(delivery.parcelDescription
                  ? { description: delivery.parcelDescription }
                  : {}),
                declaredValue: delivery.declaredValue,
                acceptedParcelRequirements: true,
              },
              vehicleType: "motorbike",
              quote: {
                amount: DEMO_FARE_NGN,
                currency: "NGN",
                isDemo: true,
              },
              payment: {
                responsibility: delivery.paymentResponsibility,
                method: paysNow ? "demo" : "cash",
                status: paysNow ? "pending" : "due_on_delivery",
                reference: `delivery_${reference}`,
              },
              status: paysNow ? "pending_payment" : "pending",
              source: "web",
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const existingBooking = await DeliveryBooking.findOne({
          userId: bookingOwnerId,
          idempotencyKey: deliveryIdempotencyKey,
        });
        if (!existingBooking) throw error;
      }
    }

    const bookings = await DeliveryBooking.find({ batchReference })
      .sort({ batchIndex: 1 })
      .lean();
    if (bookings.length !== deliveries.length) {
      throw new Error("The delivery group could not be saved completely.");
    }
    const amountDueNow = bookings.reduce(
      (total, booking) =>
        booking.payment.responsibility === "sender" &&
        booking.payment.status !== "paid"
          ? total + booking.quote.amount
          : total,
      0
    );

    return NextResponse.json(
      {
        success: true,
        batchReference,
        deliveryCount: bookings.length,
        amountDueNow,
        deliveries: bookings.map((booking) => ({
          reference: booking.reference,
          recipient: booking.recipient,
          status: booking.status,
          quote: booking.quote,
          paymentResponsibility: booking.payment.responsibility,
          paymentStatus: booking.payment.status,
        })),
      },
      { status: existingBatch.length ? 200 : 201 }
    );
  } catch (error) {
    console.error("Could not save delivery request:", error);
    return NextResponse.json(
      { success: false, message: "We couldn't save your delivery request. Please try again." },
      { status: 500 }
    );
  }
}
