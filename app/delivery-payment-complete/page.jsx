"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DeliveryPaymentCompletePage() {
  const [status, setStatus] = useState("checking");
  const [reference, setReference] = useState("");

  useEffect(() => {
    let active = true;
    const bookingReference = new URLSearchParams(window.location.search).get("reference") || "";
    setReference(bookingReference);
    if (!bookingReference) {
      setStatus("not_found");
      return () => {
        active = false;
      };
    }

    fetch(`/api/delivery-bookings/payment?reference=${encodeURIComponent(bookingReference)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Payment status could not be checked.");
        }
        if (active) setStatus(result.status);
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const isPaid = status === "paid";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-600">
          AH Parcel Delivery
        </p>
        <h1 className="text-2xl font-semibold text-gray-900">
          {status === "checking"
            ? "Checking payment status…"
            : isPaid
              ? "Demo payment recorded"
              : status === "unavailable"
                ? "Payment status unavailable"
                : "Payment not confirmed"}
        </h1>
        <p className="mt-4 leading-7 text-gray-600">
          {isPaid
            ? "The local demo payment was recorded successfully. No money was charged."
            : status === "checking"
              ? "We are verifying the payment status for this delivery request."
              : "We could not verify a completed payment. No payment success is being reported."}
        </p>
        {reference && (
          <p className="mt-4 text-sm text-gray-700">
            Delivery reference: <strong>{reference}</strong>
          </p>
        )}
        {!isPaid && reference && (
          <Link
            className="mt-6 inline-block rounded-full bg-orange-600 px-5 py-2.5 font-medium text-white hover:bg-orange-700"
            href={`/payment?deliveryBooking=${encodeURIComponent(reference)}`}
          >
            Return to demo checkout
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
