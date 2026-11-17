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

function summarizeBatch(bookings, includeRecipientDue = false) {
  const senderPayments = bookings.filter(
    (booking) => (booking.payment?.responsibility || "sender") === "sender"
  );
  const pendingNow = senderPayments.filter(
    (booking) => booking.payment?.status !== "paid"
  );
  const codPayments = bookings.filter(
    (booking) => booking.payment?.responsibility === "recipient"
  );
  const recipientDueNow = includeRecipientDue
    ? codPayments.filter(
        (booking) => booking.payment?.status === "due_on_delivery"
      )
    : [];
  const amountDueNow = [...pendingNow, ...recipientDueNow].reduce(
    (total, booking) => total + (booking.quote?.amount || 0),
    0
  );
  const amountPaidNow = bookings
    .filter((booking) => booking.payment?.status === "paid")
    .reduce((total, booking) => total + (booking.quote?.amount || 0), 0);
  const podDueTotal = codPayments
    .filter((booking) => booking.payment?.status === "due_on_delivery")
    .reduce((total, booking) => total + (booking.quote?.amount || 0), 0);
  const podCollectedTotal = codPayments
    .filter((booking) => booking.payment?.status === "collected")
    .reduce((total, booking) => total + (booking.quote?.amount || 0), 0);
  const canPayNow = pendingNow.length > 0 || recipientDueNow.length > 0;
  const allPaymentsSettled = bookings.every((booking) =>
    ["paid", "collected"].includes(booking.payment?.status)
  );
  const status = canPayNow
    ? "pending"
    : allPaymentsSettled
      ? "paid"
      : senderPayments.length === 0
        ? "not_required"
        : "paid";

  return {
    status,
    deliveryCount: bookings.length,
    batchReference: bookings[0]?.batchReference || bookings[0]?.reference,
    amountDueNow,
    amountPaidNow,
    podDueTotal,
    podCollectedTotal,
    deliveries: bookings.map((booking) => ({
      reference: booking.reference,
      recipient: booking.recipient,
      deliveryAddress: booking.delivery?.address,
      amount: booking.quote?.amount || 0,
      paymentResponsibility: booking.payment?.responsibility || "sender",
      paymentStatus: booking.payment?.status,
    })),
  };
}

async function findOrder(reference, batchReference) {
  if (batchReference) {
    const bookings = await DeliveryBooking.find({ batchReference })
      .sort({ batchIndex: 1 })
      .lean();
    return bookings;
  }
  const booking = await DeliveryBooking.findOne({ reference }).lean();
  return booking ? [booking] : [];
}

export async function GET(request) {
  if (!isDevelopmentDemoMode()) return demoPaymentDisabled();
  const search = new URL(request.url).searchParams;
  const reference = search.get("reference")?.trim() || "";
  const batchReference = search.get("batchReference")?.trim() || "";
  if (!reference && !batchReference) {
    return NextResponse.json(
      { success: false, message: "A delivery reference is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const bookings = await findOrder(reference, batchReference);
    if (!bookings.length) {
      return NextResponse.json(
        { success: false, message: "This delivery request could not be found." },
        { status: 404 }
      );
    }
    if (
      batchReference &&
      bookings[0].batchSize &&
      bookings.length !== bookings[0].batchSize
    ) {
      return NextResponse.json(
        { success: false, message: "This order is still being saved. Please try again shortly." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      ...summarizeBatch(bookings, Boolean(reference && !batchReference)),
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
  const batchReference =
    typeof payload?.batchReference === "string"
      ? payload.batchReference.trim()
      : "";
  if (!reference && !batchReference) {
    return NextResponse.json(
      { success: false, message: "A delivery reference is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const bookings = await findOrder(reference, batchReference);
    if (!bookings.length) {
      return NextResponse.json(
        { success: false, message: "This delivery request could not be found." },
        { status: 404 }
      );
    }
    if (
      batchReference &&
      bookings[0].batchSize &&
      bookings.length !== bookings[0].batchSize
    ) {
      return NextResponse.json(
        { success: false, message: "This order is still being saved. Please try again shortly." },
        { status: 409 }
      );
    }

    if (!batchReference) {
      const booking = bookings[0];
      if (["paid", "collected"].includes(booking.payment?.status)) {
        return NextResponse.json({ success: true, alreadyPaid: true });
      }

      const recipientOnlinePayment =
        booking.payment?.responsibility === "recipient" &&
        booking.payment?.status === "due_on_delivery" &&
        !["completed", "cancelled"].includes(booking.status);
      const senderCheckoutPayment =
        (booking.payment?.responsibility || "sender") === "sender" &&
        booking.payment?.status === "pending" &&
        booking.status === "pending_payment";

      if (!recipientOnlinePayment && !senderCheckoutPayment) {
        return NextResponse.json(
          { success: false, message: "This delivery cannot be paid in its current state." },
          { status: 409 }
        );
      }

      const filter = recipientOnlinePayment
        ? {
            reference: booking.reference,
            "payment.responsibility": "recipient",
            "payment.status": "due_on_delivery",
            status: { $nin: ["completed", "cancelled"] },
          }
        : {
            reference: booking.reference,
            "payment.responsibility": "sender",
            "payment.status": "pending",
            status: "pending_payment",
          };
      const update = {
        $set: {
          "payment.status": "paid",
          "payment.method": "demo",
        },
      };
      if (senderCheckoutPayment) update.$set.status = "pending";

      const updatedBooking = await DeliveryBooking.findOneAndUpdate(
        filter,
        update,
        { new: true }
      )
        .select("payment.status")
        .lean();
      if (!updatedBooking) {
        const latestBooking = await DeliveryBooking.findOne({
          reference: booking.reference,
        })
          .select("payment.status")
          .lean();
        if (latestBooking && ["paid", "collected"].includes(latestBooking.payment?.status)) {
          return NextResponse.json({ success: true, alreadyPaid: true });
        }
        return NextResponse.json(
          { success: false, message: "We couldn't confirm this delivery payment. Please try again." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Demo payment successful.",
      });
    }

    const senderPayments = bookings.filter(
      (booking) => (booking.payment?.responsibility || "sender") === "sender"
    );
    if (!senderPayments.length) {
      return NextResponse.json(
        { success: false, message: "There is no payment due at checkout for this order." },
        { status: 409 }
      );
    }
    if (senderPayments.every((booking) => booking.payment?.status === "paid")) {
      return NextResponse.json({ success: true, alreadyPaid: true });
    }
    if (
      senderPayments.some(
        (booking) =>
          booking.payment?.status !== "paid" &&
          (booking.status !== "pending_payment" ||
            booking.payment?.status !== "pending")
      )
    ) {
      return NextResponse.json(
        { success: false, message: "This order cannot be paid in its current state." },
        { status: 409 }
      );
    }

    const filter = batchReference
      ? {
          batchReference,
          "payment.responsibility": "sender",
          "payment.status": "pending",
          status: "pending_payment",
        }
      : {
          reference,
          "payment.status": "pending",
          status: "pending_payment",
        };
    await DeliveryBooking.updateMany(filter, {
      $set: {
        status: "pending",
        "payment.status": "paid",
        "payment.method": "demo",
      },
    });

    const updatedBookings = await findOrder(reference, batchReference);
    const allSenderPaymentsPaid = updatedBookings
      .filter(
        (booking) => (booking.payment?.responsibility || "sender") === "sender"
      )
      .every((booking) => booking.payment?.status === "paid");
    if (!allSenderPaymentsPaid) {
      return NextResponse.json(
        { success: false, message: "We couldn't confirm all checkout payments. Please try again." },
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
