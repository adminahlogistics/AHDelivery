import connectDB from "@/config/db";
import { isDevelopmentDemoMode } from "@/lib/accessControl";
import DeliveryBooking from "@/models/DeliveryBooking";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function demoPaymentDisabled() {
  return NextResponse.json(
    {
      success: false,
      message: "Demo payment is available only in local development.",
    },
    { status: 503 }
  );
}

export async function GET(request) {
  if (!isDevelopmentDemoMode()) return demoPaymentDisabled();
  const reference = new URL(request.url).searchParams.get("reference")?.trim();
  if (!reference) {
    return NextResponse.json(
      { success: false, message: "A delivery reference is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const booking = await DeliveryBooking.findOne({ reference }).select(
      "reference status payment.status"
    ).lean();
    if (!booking) {
      return NextResponse.json(
        { success: false, message: "This delivery request could not be found." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      reference: booking.reference,
      status: booking.payment.status === "paid" ? "paid" : "pending",
    });
  } catch (error) {
    console.error("Could not verify demo payment status:", error);
    return NextResponse.json(
      { success: false, message: "Payment status is temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!isDevelopmentDemoMode()) return demoPaymentDisabled();
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The payment request could not be read." },
      { status: 400 }
    );
  }

  const reference =
    typeof payload?.reference === "string" ? payload.reference.trim() : "";
  if (!reference) {
    return NextResponse.json(
      { success: false, message: "A delivery reference is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const booking = await DeliveryBooking.findOne({ reference }).select(
      "status payment.status"
    );
    if (!booking) {
      return NextResponse.json(
        { success: false, message: "This delivery request could not be found." },
        { status: 404 }
      );
    }

    if (booking.payment.status === "paid") {
      return NextResponse.json({ success: true, alreadyPaid: true });
    }

    if (booking.status !== "pending_payment") {
      return NextResponse.json(
        { success: false, message: "This delivery request cannot be paid." },
        { status: 409 }
      );
    }

    const updateResult = await DeliveryBooking.updateOne(
      { _id: booking._id, status: "pending_payment" },
      {
        $set: {
          status: "pending",
          "payment.status": "paid",
          "payment.method": "demo",
        },
      }
    );
    if (updateResult.modifiedCount !== 1) {
      return NextResponse.json(
        { success: false, message: "This delivery request was already updated." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Demo payment successful.",
    });
  } catch (error) {
    console.error("Could not confirm demo delivery payment:", error);
    return NextResponse.json(
      {
        success: false,
        message: "We couldn't confirm the demo payment. Please try again.",
      },
      { status: 500 }
    );
  }
}
