import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import { normalizeCustomerPhone } from "@/lib/customerIdentity";
import CustomerBlock from "@/models/CustomerBlock";
import DeliveryBooking from "@/models/DeliveryBooking";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const readCustomerPhone = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
};

export async function GET(_request, { params }) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  const { phone: encodedPhone } = await params;
  const phone = readCustomerPhone(encodedPhone);
  if (!phone) {
    return NextResponse.json(
      { success: false, message: "A customer phone number is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const orders = await DeliveryBooking.find({ "sender.phone": phone })
      .select(
        "reference sender recipient pickup delivery parcel quote payment status deliveryType createdAt completedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) {
      return NextResponse.json(
        { success: false, message: "Customer record not found." },
        { status: 404 }
      );
    }

    const completedDeliveries = orders.filter(
      (order) => order.status === "completed"
    ).length;
    const block = await CustomerBlock.findOne({
      phone: normalizeCustomerPhone(phone),
    })
      .select("blockedAt")
      .lean();

    return NextResponse.json({
      success: true,
      customer: {
        name: orders[0].sender.name,
        phone,
        createdAt: orders[orders.length - 1].createdAt,
        lastOrderAt: orders[0].createdAt,
        deliveryCount: orders.length,
        completedDeliveries,
        blocked: Boolean(block),
        blockedAt: block?.blockedAt || null,
      },
      orders,
    });
  } catch (error) {
    console.error("Could not load customer details:", error);
    return NextResponse.json(
      { success: false, message: "Customer details are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  const { phone: encodedPhone } = await params;
  const displayPhone = readCustomerPhone(encodedPhone);
  const phone = normalizeCustomerPhone(displayPhone);
  if (!phone) {
    return NextResponse.json(
      { success: false, message: "A valid customer phone number is required." },
      { status: 400 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The customer update could not be read." },
      { status: 400 }
    );
  }

  if (!["block", "unblock"].includes(payload?.action)) {
    return NextResponse.json(
      { success: false, message: "Choose whether to block or unblock this customer." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    if (payload.action === "block") {
      await CustomerBlock.updateOne(
        { phone },
        { $setOnInsert: { phone, displayPhone, blockedAt: new Date() } },
        { upsert: true, runValidators: true }
      );
    } else {
      await CustomerBlock.deleteOne({ phone });
    }

    return NextResponse.json({
      success: true,
      blocked: payload.action === "block",
    });
  } catch (error) {
    console.error("Could not update customer block status:", error);
    return NextResponse.json(
      { success: false, message: "Customer status could not be updated." },
      { status: 500 }
    );
  }
}
