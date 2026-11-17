"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import LandingHeader from "@/components/LandingHeader";

export default function PaymentPage() {
  const [reference, setReference] = useState("");
  const [batchReference, setBatchReference] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoPaymentOpen, setIsDemoPaymentOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const selectedBatchReference = search.get("batchReference") || "";
    const selectedReference = search.get("deliveryBooking") || "";
    setBatchReference(selectedBatchReference);
    setReference(selectedReference);
    if (process.env.NODE_ENV !== "development") {
      setError("Demo payment is disabled outside local development.");
    }

    if (!selectedBatchReference && !selectedReference) {
      setIsLoading(false);
      return;
    }

    const paymentQuery = selectedBatchReference
      ? `batchReference=${encodeURIComponent(selectedBatchReference)}`
      : `reference=${encodeURIComponent(selectedReference)}`;
    fetch(`/api/delivery-bookings/payment?${paymentQuery}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load the order total.");
        }
        setOrderDetails(result);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load the order total."
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const confirmDemoPayment = async () => {
    setIsConfirming(true);
    setError("");
    try {
      const response = await fetch("/api/delivery-bookings/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          batchReference ? { batchReference } : { reference }
        ),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to confirm demo payment.");
      }

      const confirmationUrl = batchReference
        ? `/delivery-payment-complete?batchReference=${encodeURIComponent(batchReference)}`
        : `/delivery-payment-complete?reference=${encodeURIComponent(reference)}`;
      window.location.assign(confirmationUrl);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to confirm demo payment. Please try again."
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const amountDueNow = orderDetails?.amountDueNow ?? 0;

  return (
    <>
      <LandingHeader />
      <main className="mx-auto min-h-[55vh] max-w-xl px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
          Local demo checkout
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">
          Confirm delivery payment
        </h1>
        {reference || batchReference ? (
          <>
            <p className="mt-6 text-gray-600">
              Order <strong>{batchReference || reference}</strong>
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {isLoading ? "Loading…" : `₦${amountDueNow.toLocaleString()}`}
            </p>
            <p className="mt-2 text-sm text-gray-600">Payable now</p>
            {orderDetails?.deliveries?.length > 0 && (
              <div className="mt-6 rounded-xl border border-gray-200 text-left">
                {orderDetails.deliveries.map((delivery) => (
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
                          ? reference
                            ? delivery.paymentStatus === "paid"
                              ? "Recipient payment complete"
                              : "Recipient payment link"
                            : "Pay on delivery"
                          : delivery.paymentStatus === "paid"
                            ? "Already paid"
                            : "Pay now"}
                      </small>
                    </span>
                    <strong className="whitespace-nowrap text-sm text-gray-800">
                      ₦{delivery.amount.toLocaleString()}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {amountDueNow > 0 ? (
              <>
                <p className="mt-3 text-sm text-gray-500">
                  No money will be charged in this local demo. Continuing marks
                  the payment for this delivery as paid.
                </p>
                <button
                  className="mt-7 rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    isLoading ||
                    isConfirming ||
                    process.env.NODE_ENV !== "development"
                  }
                  onClick={() => setIsDemoPaymentOpen(true)}
                  type="button"
                >
                  Continue to demo payment
                </button>
              </>
            ) : orderDetails && !isLoading ? (
              <Link
                className="mt-7 inline-block rounded-full bg-orange-600 px-6 py-3 font-semibold text-white"
                href={
                  batchReference
                    ? `/delivery-payment-complete?batchReference=${encodeURIComponent(batchReference)}`
                    : `/delivery-payment-complete?reference=${encodeURIComponent(reference)}`
                }
              >
                Continue to order confirmation
              </Link>
            ) : null}
          </>
        ) : (
          <p className="mt-6 text-gray-600">No delivery reference was provided.</p>
        )}
        {error && <p className="mt-5 text-sm text-red-700" role="alert">{error}</p>}
        <Link className="mt-6 block text-sm text-gray-600 underline" href="/">
          Cancel and return home
        </Link>
      </main>
      <Footer />

      {isDemoPaymentOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isConfirming) {
              setIsDemoPaymentOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="demo-payment-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-xl"
            role="dialog"
          >
            <h2 className="text-2xl font-semibold text-gray-900" id="demo-payment-title">
              Confirm demo payment
            </h2>
            <p className="mt-4 text-gray-600">
              {batchReference || reference} · ₦{amountDueNow.toLocaleString()}
            </p>
            <p className="mt-3 text-sm text-gray-500">No money will be charged.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                className="rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
                disabled={isConfirming}
                onClick={confirmDemoPayment}
                type="button"
              >
                {isConfirming ? "Confirming…" : "Mark demo payment complete"}
              </button>
              <button
                className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700"
                onClick={() => setIsDemoPaymentOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
