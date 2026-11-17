"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DeliveryPaymentCompletePage() {
  const [status, setStatus] = useState("checking");
  const [reference, setReference] = useState("");
  const [batchReference, setBatchReference] = useState("");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let active = true;
    const search = new URLSearchParams(window.location.search);
    const bookingReference = search.get("reference") || "";
    const orderBatchReference = search.get("batchReference") || "";
    setReference(bookingReference);
    setBatchReference(orderBatchReference);
    if (!bookingReference && !orderBatchReference) {
      setStatus("not_found");
      return () => {
        active = false;
      };
    }

    const paymentQuery = orderBatchReference
      ? `batchReference=${encodeURIComponent(orderBatchReference)}`
      : `reference=${encodeURIComponent(bookingReference)}`;
    fetch(`/api/delivery-bookings/payment?${paymentQuery}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Payment status could not be checked.");
        }
        if (active) {
          setOrder(result);
          setStatus(result.status);
        }
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const isPaid = status === "paid";
  const isPayOnDeliveryOnly = status === "not_required";
  const orderReference = batchReference || reference;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-600">
          AH Parcel Delivery
        </p>
        <h1 className="text-2xl font-semibold text-gray-900">
          {status === "checking"
            ? "Checking order status…"
            : isPaid
              ? "Order placed · Payment recorded"
              : isPayOnDeliveryOnly
                ? "Order placed · Pay on delivery"
                : status === "unavailable"
                  ? "Order status unavailable"
                  : "Payment not confirmed"}
        </h1>
        <p className="mt-4 leading-7 text-gray-600">
          {isPaid
            ? "The local demo recorded the delivery payment. No money was charged."
            : isPayOnDeliveryOnly
              ? "Your deliveries are recorded. Recipients can pay the rider or use a payment link shared by the rider."
              : status === "checking"
                ? "We are verifying your delivery order."
                : "We could not verify the order status. No payment success is being reported."}
        </p>
        {orderReference && (
          <p className="mt-4 text-sm text-gray-700">
            Order reference: <strong>{orderReference}</strong>
          </p>
        )}

        {order && (
          <div className="mt-6 rounded-xl border border-gray-200 text-left">
            <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-4 text-sm">
              <span className="text-gray-500">Deliveries</span>
              <strong className="text-right">{order.deliveryCount}</strong>
              <span className="text-gray-500">Pay on delivery</span>
              <strong className="text-right">
                ₦{order.podDueTotal.toLocaleString()}
              </strong>
              <span className="text-gray-500">Already paid</span>
              <strong className="text-right">
                ₦{order.amountPaidNow.toLocaleString()}
              </strong>
            </div>
            {order.deliveries.map((delivery) => (
              <div
                className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0"
                key={delivery.reference}
              >
                <span>
                  <strong className="block text-sm text-gray-800">
                    {delivery.recipient?.name || "Recipient"}
                  </strong>
                  <small className="text-gray-500">
                    {delivery.paymentResponsibility === "recipient"
                      ? delivery.paymentStatus === "collected"
                        ? "Pay on delivery · collected"
                        : "Pay on delivery · due"
                      : delivery.paymentStatus === "paid"
                        ? "Paid now"
                        : "Payment pending"}
                  </small>
                </span>
                <strong className="whitespace-nowrap text-sm text-gray-800">
                  ₦{delivery.amount.toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
        )}

        {status === "pending" && orderReference && (
          <Link
            className="mt-6 inline-block rounded-full bg-orange-600 px-5 py-2.5 font-medium text-white hover:bg-orange-700"
            href={
              batchReference
                ? `/payment?batchReference=${encodeURIComponent(batchReference)}`
                : `/payment?deliveryBooking=${encodeURIComponent(reference)}`
            }
          >
            Return to checkout
          </Link>
        )}
        <div>
          <Link className="mt-6 inline-block text-sm font-medium text-gray-700 underline" href="/">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
