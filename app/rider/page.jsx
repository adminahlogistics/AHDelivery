"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const currency = process.env.NEXT_PUBLIC_CURRENCY || "₦";
const RIDER_STORAGE_KEY = "ah-delivery-demo-rider-id";

export default function RiderDashboard() {
  const [riders, setRiders] = useState([]);
  const [riderId, setRiderId] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingReference, setUpdatingReference] = useState("");

  const loadBookings = useCallback(async (selectedRiderId) => {
    if (!selectedRiderId) {
      setBookings([]);
      return;
    }

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
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your deliveries."
      );
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
    window.localStorage.setItem(RIDER_STORAGE_KEY, selectedId);
    loadBookings(selectedId);
  };

  const updateBooking = async (booking, action) => {
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
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not update this delivery.");
      }
      setBookings((current) =>
        current.map((item) =>
          item.reference === booking.reference
            ? { ...item, ...result.booking }
            : item
        )
      );
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

  return (
    <main className="rider-dashboard">
      <header className="rider-header">
        <div>
          <p className="admin-eyebrow">AH DELIVERY · LOCAL DEMO</p>
          <h1>Rider deliveries</h1>
          <p>This profile selector is a demo convenience, not authentication.</p>
        </div>
        <Link href="/">Back to website</Link>
      </header>

      <section className="rider-message">
        <label htmlFor="demo-rider">Choose a rider profile</label>
        <select
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3"
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
        {!loading && riders.length === 0 && !error && (
          <p className="mt-3">No active rider profiles are available.</p>
        )}
      </section>

      {error && <p className="admin-booking-error" role="alert">{error}</p>}
      {loading ? (
        <p className="admin-booking-empty">Loading rider profiles…</p>
      ) : !riderId ? (
        <p className="admin-booking-empty">Select a profile to view its assigned deliveries.</p>
      ) : !bookings.length && !error ? (
        <p className="admin-booking-empty">No deliveries are assigned to this rider.</p>
      ) : (
        <div className="rider-delivery-list">
          {bookings.map((booking) => (
            <article className="rider-delivery-card" key={booking.reference}>
              <div className="rider-delivery-heading">
                <h2>{booking.reference}</h2>
                <span className={`order-status order-status-${booking.status}`}>
                  <span />
                  {booking.status === "in_progress" ? "In-progress" : booking.status}
                </span>
              </div>
              <p><strong>Pickup:</strong> {booking.pickup?.address}</p>
              <p><strong>Delivery:</strong> {booking.delivery?.address}</p>
              <p><strong>Sender:</strong> {booking.sender?.name} · {booking.sender?.phone}</p>
              <p><strong>Recipient:</strong> {booking.recipient?.name} · {booking.recipient?.phone}</p>
              <p>
                <strong>Package:</strong> {booking.parcel?.category || "Parcel"}
                {booking.parcel?.description ? ` — ${booking.parcel.description}` : ""}
              </p>
              <p>
                <strong>Declared item value:</strong> {currency}
                {(booking.parcel?.declaredValue || 0).toLocaleString()}
              </p>
              <div className="rider-delivery-actions">
                {booking.status === "assigned" && (
                  <button
                    disabled={updatingReference === booking.reference}
                    onClick={() => updateBooking(booking, "start")}
                    type="button"
                  >
                    {updatingReference === booking.reference ? "Starting…" : "Start ride"}
                  </button>
                )}
                {booking.status === "in_progress" && (
                  <button
                    disabled={updatingReference === booking.reference}
                    onClick={() => updateBooking(booking, "complete")}
                    type="button"
                  >
                    {updatingReference === booking.reference ? "Saving…" : "Mark delivered"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
