"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const currency = process.env.NEXT_PUBLIC_CURRENCY || "₦";
const RIDER_STORAGE_KEY = "ah-delivery-demo-rider-id";

const paymentStatusLabel = (payment) => {
  if (payment?.status === "paid") return "Paid online";
  if (payment?.status === "collected") return "Collected by rider";
  if (payment?.status === "due_on_delivery") return "Due from recipient";
  if (payment?.status === "pending") return "Awaiting sender payment";
  return payment?.status || "Not started";
};

const formatStatus = (status) => {
  if (status === "in_transit" || status === "in_progress") return "In transit";
  if (status === "at_hub") return "At hub";
  return (status || "unknown").replaceAll("_", " ");
};

const formatDistance = (distance) =>
  `${Number(distance || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} km`;

export default function RiderDashboardContent() {
  const [riders, setRiders] = useState([]);
  const [riderId, setRiderId] = useState("");
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingReference, setUpdatingReference] = useState("");
  const [distanceInputs, setDistanceInputs] = useState({});
  const [paymentLinkMessage, setPaymentLinkMessage] = useState("");

  const loadBookings = useCallback(async (selectedRiderId) => {
    if (!selectedRiderId) {
      setBookings([]);
      setSummary(null);
      return;
    }

    setBookingsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/rider/delivery-bookings?riderId=${encodeURIComponent(selectedRiderId)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load your deliveries.");
      }
      setBookings(result.bookings);
      setSummary(result.summary);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your deliveries."
      );
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const response = await fetch("/api/rider/profile", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load rider profiles.");
        }
        if (!active) return;
        setRiders(result.riders);
        const savedId = window.localStorage.getItem(RIDER_STORAGE_KEY);
        const selected = result.riders.find((rider) => rider.id === savedId);
        if (selected) {
          setRiderId(selected.id);
          await loadBookings(selected.id);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load rider profiles."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    initialize();
    return () => {
      active = false;
    };
  }, [loadBookings]);

  useEffect(() => {
    if (!riderId) return undefined;
    const refresh = () => {
      if (document.visibilityState === "visible") loadBookings(riderId);
    };
    const interval = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadBookings, riderId]);

  const selectRider = (event) => {
    const selectedId = event.target.value;
    setRiderId(selectedId);
    setDistanceInputs({});
    setPaymentLinkMessage("");
    window.localStorage.setItem(RIDER_STORAGE_KEY, selectedId);
    loadBookings(selectedId);
  };

  const updateBooking = async (booking, action) => {
    const requiresDistance = ["arrive_hub", "complete"].includes(action);
    const rawDistance = distanceInputs[booking.reference] || "";
    const distanceKm = Number(rawDistance);
    if (
      requiresDistance &&
      (!rawDistance || !Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 1000)
    ) {
      setError("Enter this trip’s distance in kilometres before completing it.");
      return;
    }

    setUpdatingReference(booking.reference);
    setError("");
    try {
      const response = await fetch("/api/rider/delivery-bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: booking.reference,
          action,
          riderId,
          ...(requiresDistance ? { distanceKm } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not update this delivery.");
      }
      setDistanceInputs((current) => ({
        ...current,
        [booking.reference]: "",
      }));
      await loadBookings(riderId);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update this delivery."
      );
    } finally {
      setUpdatingReference("");
    }
  };

  const copyPaymentLink = async (booking) => {
    const paymentUrl = `${window.location.origin}/payment?deliveryBooking=${encodeURIComponent(booking.reference)}`;
    setPaymentLinkMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(paymentUrl);
      setPaymentLinkMessage(`Payment link copied for ${booking.reference}.`);
    } catch (copyError) {
      setPaymentLinkMessage(
        copyError instanceof Error
          ? copyError.message
          : "Could not copy the payment link."
      );
    }
  };

  const selectedRider = riders.find((rider) => rider.id === riderId);

  return (
    <main className="rider-dashboard">
      <header className="rider-header">
        <div>
          <p className="admin-eyebrow">AH DELIVERY · RIDER PORTAL</p>
          <h1>Rider workspace</h1>
          <p>Assigned deliveries, trip progress, and rider activity.</p>
        </div>
        <Link href="/">Back to website</Link>
      </header>

      <section className="rider-message">
        <div className="rider-profile-copy">
          <strong>{selectedRider ? `Welcome, ${selectedRider.name}` : "Choose your rider profile"}</strong>
          <span>
            {selectedRider
              ? "View your assigned deliveries and record the distance for each trip."
              : "Select your demo rider profile to see assigned deliveries."}
          </span>
        </div>
        <label htmlFor="demo-rider">
          Rider profile
          <select
            disabled={loading}
            id="demo-rider"
            onChange={selectRider}
            value={riderId}
          >
            <option value="">Select a rider</option>
            {riders.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}
              </option>
            ))}
          </select>
        </label>
        <p className="rider-demo-note">
          Demo portal: the profile selector is for local workflow testing and is not rider authentication.
        </p>
      </section>

      {error && <p className="admin-booking-error" role="alert">{error}</p>}
      {!loading && riders.length === 0 && !error && (
        <p className="rider-empty-state">No active rider profiles are available.</p>
      )}
      {loading ? (
        <p className="admin-booking-empty">Loading rider profiles…</p>
      ) : !riderId ? (
        <p className="rider-empty-state">Select a rider profile to view its delivery activity.</p>
      ) : (
        <>
          <section className="rider-summary" aria-label="Rider delivery totals">
            <article className="rider-summary-card">
              <strong>{summary?.orderCount || 0}</strong>
              <span>Orders handled</span>
            </article>
            <article className="rider-summary-card">
              <strong>{summary?.completedTrips || 0}</strong>
              <span>Trips completed</span>
            </article>
            <article className="rider-summary-card">
              <strong>{formatDistance(summary?.totalKilometers)}</strong>
              <span>Total kilometers recorded</span>
            </article>
          </section>

          <section>
            <div className="rider-section-heading">
              <div>
                <h2>Your deliveries</h2>
                <p>
                  {bookingsLoading
                    ? "Refreshing delivery list…"
                    : `${bookings.length} ${bookings.length === 1 ? "delivery" : "deliveries"} in your activity`}
                </p>
              </div>
            </div>

            {bookingsLoading && !bookings.length ? (
              <p className="rider-empty-state">Loading your deliveries…</p>
            ) : !bookings.length ? (
              <p className="rider-empty-state">No deliveries are assigned to this rider yet.</p>
            ) : (
              <div className="rider-delivery-list">
                {bookings.map((booking) => {
                  const isUpdating = updatingReference === booking.reference;
                  const distanceInput = distanceInputs[booking.reference] || "";
                  const hasRecipientPaymentDue =
                    booking.payment?.responsibility === "recipient" &&
                    booking.payment?.status === "due_on_delivery";
                  const recordedDistance = booking.riderDistances.reduce(
                    (total, entry) => total + entry.distanceKm,
                    0
                  );
                  const paymentStatusClass =
                    booking.payment?.status === "paid" ||
                    booking.payment?.status === "collected"
                      ? "rider-payment-status-paid"
                      : booking.payment?.status === "due_on_delivery" ||
                          booking.payment?.status === "pending"
                        ? "rider-payment-status-pending"
                        : "";
                  const activityStatus =
                    !booking.isCurrentRider && booking.riderDistances.length
                        ? "Trip completed"
                        : formatStatus(booking.status);
                  const activityStatusClass =
                    !booking.isCurrentRider && booking.riderDistances.length
                        ? "completed"
                        : booking.status;
                  const needsDistance =
                    booking.isCurrentRider &&
                    booking.status === "in_transit";

                  return (
                    <article className="rider-delivery-card" key={booking.reference}>
                      <div className="rider-delivery-heading">
                        <h2>
                          {booking.reference}
                          {booking.batchSize > 1 &&
                            ` · Delivery ${(booking.batchIndex || 0) + 1} of ${booking.batchSize}`}
                        </h2>
                        <span className={`order-status order-status-${activityStatusClass}`}>
                          <span />
                          {activityStatus}
                        </span>
                      </div>
                      <div className="rider-delivery-card-grid">
                        <p><strong>Route:</strong> {booking.routeLegLabel}</p>
                        <p><strong>Pickup:</strong> {booking.pickup?.address}</p>
                        <p><strong>Delivery:</strong> {booking.delivery?.address}</p>
                        <p><strong>Sender:</strong> {booking.sender?.name} · {booking.sender?.phone}</p>
                        <p><strong>Recipient:</strong> {booking.recipient?.name} · {booking.recipient?.phone}</p>
                        <p>
                          <strong>Package:</strong> {booking.parcel?.category || "Parcel"}
                          {booking.parcel?.description ? ` — ${booking.parcel.description}` : ""}
                        </p>
                        <p>
                          <strong>Delivery fee:</strong> {currency}
                          {(booking.quote?.amount || 0).toLocaleString()}
                        </p>
                        <p>
                          <strong>Payer:</strong>{" "}
                          {booking.payment?.responsibility === "recipient"
                            ? "Recipient"
                            : "Sender"}
                        </p>
                        <p>
                          <strong>Payment:</strong>{" "}
                          <span className={`rider-payment-status ${paymentStatusClass}`}>
                            {paymentStatusLabel(booking.payment)}
                          </span>
                        </p>
                      </div>

                      {recordedDistance > 0 && (
                        <p className="rider-trip-distance">
                          Your recorded trip distance: {formatDistance(recordedDistance)}
                        </p>
                      )}

                      {needsDistance && (
                        <label className="rider-distance-field">
                          Trip distance (km)
                          <input
                            inputMode="decimal"
                            max="1000"
                            min="0"
                            onChange={(event) =>
                              setDistanceInputs((current) => ({
                                ...current,
                                [booking.reference]: event.target.value,
                              }))
                            }
                            placeholder="e.g. 8.5"
                            step="0.1"
                            type="number"
                            value={distanceInput}
                          />
                        </label>
                      )}

                      <div className="rider-delivery-actions">
                        {booking.isCurrentRider &&
                          booking.status === "assigned" && (
                            <button
                              disabled={isUpdating}
                              onClick={() => updateBooking(booking, "start")}
                              type="button"
                            >
                              {isUpdating ? "Starting…" : "Start ride"}
                            </button>
                          )}
                        {booking.isCurrentRider &&
                          booking.status === "in_transit" &&
                          booking.currentLeg === "to_hub" && (
                            <button
                              disabled={isUpdating || !distanceInput}
                              onClick={() => updateBooking(booking, "arrive_hub")}
                              type="button"
                            >
                              {isUpdating ? "Saving…" : "Record distance & arrive at hub"}
                            </button>
                          )}
                        {booking.isCurrentRider &&
                          booking.status === "in_transit" &&
                          booking.currentLeg !== "to_hub" &&
                          hasRecipientPaymentDue && (
                            <>
                              <button
                                disabled={isUpdating}
                                onClick={() => updateBooking(booking, "collect_payment")}
                                type="button"
                              >
                                {isUpdating
                                  ? "Saving…"
                                  : `Confirm cash collected · ${currency}${(booking.quote?.amount || 0).toLocaleString()}`}
                              </button>
                              <button
                                className="rider-copy-link-button"
                                disabled={isUpdating}
                                onClick={() => copyPaymentLink(booking)}
                                type="button"
                              >
                                Copy payment link
                              </button>
                            </>
                          )}
                        {booking.isCurrentRider &&
                          booking.status === "in_transit" &&
                          booking.currentLeg !== "to_hub" &&
                          !hasRecipientPaymentDue && (
                            <button
                              disabled={isUpdating || !distanceInput}
                              onClick={() => updateBooking(booking, "complete")}
                              type="button"
                            >
                              {isUpdating ? "Saving…" : "Record distance & mark delivered"}
                            </button>
                          )}
                        {booking.isCurrentRider && hasRecipientPaymentDue && (
                          <Link
                            href={`/payment?deliveryBooking=${encodeURIComponent(booking.reference)}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open payment page
                          </Link>
                        )}
                        {paymentLinkMessage && (
                          <p aria-live="polite" className="rider-link-feedback">
                            {paymentLinkMessage}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
