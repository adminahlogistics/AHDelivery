import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import { RIDER_PORTAL_ENABLED } from "@/lib/riderPortal";
import { getDeliveryHubLabel } from "@/config/deliveryHubs";
import DeliveryBooking from "@/models/DeliveryBooking";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(request) {
  if (!RIDER_PORTAL_ENABLED) {
    return NextResponse.json(
      { success: false, message: "The rider portal is temporarily disabled." },
      { status: 503 }
    );
  }

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
    const rider = await Rider.findOne({ _id: riderId, status: "active" }).select("_id name");
    if (!rider) {
      return NextResponse.json(
        { success: false, message: "The selected rider profile is not active." },
        { status: 403 }
      );
    }
    const bookings = await DeliveryBooking.find({
      $or: [
        { "rider.userId": String(rider._id) },
        { "riderAssignmentHistory.userId": String(rider._id) },
        { "riderDistanceHistory.userId": String(rider._id) },
      ],
    })
      .select(
        "reference batchReference batchIndex batchSize direction pickup delivery sender recipient parcel.category parcel.description parcel.declaredValue quote payment.responsibility payment.status status deliveryType hubLocation hubAddress currentLeg rider riderAssignmentHistory riderDistanceHistory assignedAt startedAt completedAt"
      )
      .sort({ reference: 1 })
      .lean();

    const riderIdValue = String(rider._id);
    const riderOrders = bookings.filter((booking) => {
      const currentAssignment = booking.rider?.userId === riderIdValue;
      const hasRecordedDistance = booking.riderDistanceHistory?.some(
        (entry) => entry.userId === riderIdValue
      );
      return currentAssignment || hasRecordedDistance;
    });
    const distanceEntries = bookings.flatMap((booking) =>
      (booking.riderDistanceHistory || []).filter(
        (entry) => entry.userId === riderIdValue
      )
    );
    const ordersWithCompletedTrips = new Set(
      bookings
        .filter((booking) =>
          booking.riderDistanceHistory?.some(
            (entry) => entry.userId === riderIdValue
          )
        )
        .map((booking) => booking.reference)
    );

    return NextResponse.json({
      success: true,
      summary: {
        orderCount: new Set(
          bookings
            .filter(
              (booking) =>
                booking.rider?.userId === riderIdValue ||
                booking.riderAssignmentHistory?.some(
                  (entry) => entry.userId === riderIdValue
                )
            )
            .map((booking) => booking.reference)
        ).size,
        completedOrders: ordersWithCompletedTrips.size,
        completedTrips: distanceEntries.length,
        totalKilometers:
          Math.round(
            distanceEntries.reduce(
              (total, entry) => total + entry.distanceKm,
              0
            ) * 10
          ) / 10,
      },
      bookings: riderOrders.map((booking) => {
        const currentLeg =
          booking.currentLeg ||
          (booking.deliveryType === "hub" ? "to_hub" : "direct");
        const status =
          booking.status === "in_progress" ? "in_transit" : booking.status;
        const riderDistances = (booking.riderDistanceHistory || []).filter(
          (entry) => entry.userId === riderIdValue
        );
        const isCurrentRider = booking.rider?.userId === riderIdValue;
        const displayLeg = isCurrentRider
          ? currentLeg
          : riderDistances[riderDistances.length - 1]?.leg || currentLeg;
        const hubDestination =
          getDeliveryHubLabel(booking.hubLocation) ||
          booking.hubAddress ||
          "Delivery hub";
        return {
          ...booking,
          status,
          isCurrentRider,
          riderDistances,
          hubDestination,
          currentLeg: displayLeg,
          routeLegLabel:
            displayLeg === "to_hub"
              ? "Delivery to hub"
              : displayLeg === "final_delivery"
                ? "Final delivery"
                : "Direct delivery",
          pickup:
            displayLeg === "final_delivery"
              ? { address: hubDestination }
              : booking.pickup,
          delivery:
            displayLeg === "to_hub"
              ? { address: hubDestination }
              : booking.delivery,
        };
      }),
    });
  } catch (error) {
    console.error("Could not load rider deliveries:", error);
    return NextResponse.json(
      { success: false, message: "Your deliveries are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  if (!RIDER_PORTAL_ENABLED) {
    return NextResponse.json(
      { success: false, message: "The rider portal is temporarily disabled." },
      { status: 503 }
    );
  }

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
  const distanceKm = payload?.distanceKm;
  if (
    !reference ||
    !riderId ||
    !mongoose.isValidObjectId(riderId) ||
    !["start", "arrive_hub", "collect_payment", "complete"].includes(action) ||
    (["arrive_hub", "complete"].includes(action) &&
      (typeof distanceKm !== "number" ||
        !Number.isFinite(distanceKm) ||
        distanceKm < 0 ||
        distanceKm > 1000))
  ) {
    return NextResponse.json(
      { success: false, message: "A valid delivery reference and action are required." },
      { status: 400 }
    );
  }

  const access = await requireRole("rider", riderId);
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const rider = await Rider.findOne({ _id: riderId, status: "active" }).select("_id name");
    if (!rider) {
      return NextResponse.json(
        { success: false, message: "The selected rider profile is not active." },
        { status: 403 }
      );
    }
    const activeBooking = await DeliveryBooking.findOne({
      reference,
      "rider.userId": String(rider._id),
    })
      .select("currentLeg deliveryType")
      .lean();
    if (!activeBooking) {
      return NextResponse.json(
        { success: false, message: "This delivery is not assigned to this rider." },
        { status: 403 }
      );
    }
    const activeLeg =
      activeBooking.currentLeg ||
      (activeBooking.deliveryType === "hub" ? "to_hub" : "direct");
    const updateFilter = {
      reference,
      "rider.userId": String(rider._id),
      "payment.status": { $in: ["paid", "due_on_delivery", "collected"] },
    };
    let update;
    if (action === "start") {
      updateFilter.status = "assigned";
      update = { $set: { status: "in_transit", startedAt: new Date() } };
    } else if (action === "arrive_hub") {
      updateFilter.status = { $in: ["in_transit", "in_progress"] };
      updateFilter.currentLeg = "to_hub";
      update = {
        $set: { status: "at_hub", hubReceivedAt: new Date() },
        $unset: { startedAt: 1 },
        $push: {
          riderDistanceHistory: {
            userId: String(rider._id),
            name: rider.name,
            leg: "to_hub",
            distanceKm,
            recordedAt: new Date(),
          },
        },
      };
    } else if (action === "collect_payment") {
      updateFilter.status = { $in: ["in_transit", "in_progress"] };
      updateFilter.currentLeg = { $in: ["direct", "final_delivery", null] };
      updateFilter["payment.responsibility"] = "recipient";
      updateFilter["payment.status"] = "due_on_delivery";
      update = {
        $set: {
          "payment.status": "collected",
          "payment.method": "cash",
          "payment.collectedAt": new Date(),
        },
      };
    } else {
      updateFilter.status = { $in: ["in_transit", "in_progress"] };
      updateFilter.currentLeg = { $in: ["direct", "final_delivery", null] };
      updateFilter["payment.status"] = { $in: ["paid", "collected"] };
      update = {
        $set: { status: "completed", completedAt: new Date() },
        $push: {
          riderDistanceHistory: {
            userId: String(rider._id),
            name: rider.name,
            leg: activeLeg,
            distanceKm,
            recordedAt: new Date(),
          },
        },
      };
    }

    const booking = await DeliveryBooking.findOneAndUpdate(
      updateFilter,
      update,
      { new: true }
    )
      .select("reference batchReference batchIndex batchSize status deliveryType currentLeg rider riderDistanceHistory assignedAt startedAt hubReceivedAt completedAt payment.responsibility payment.status")
      .lean();

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message:
            action === "arrive_hub"
              ? "Only a delivery currently in transit to the hub can be marked received."
              : action === "collect_payment"
                ? "Only a pay-on-delivery order in its final leg can be marked collected."
                : action === "complete"
                  ? "Collect any pay-on-delivery amount before marking the delivery complete."
                : "This delivery is not in the required status or is assigned to another rider.",
        },
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
