"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaSearch,
  FaShippingFast,
  FaTimes,
} from "react-icons/fa";
import Link from "next/link";

const statusGroups = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In-progress" },
  { key: "assigned", label: "Assigned" },
  { key: "completed", label: "Completed" },
];

const currency = process.env.NEXT_PUBLIC_CURRENCY || "₦";

const normalizeStatus = (status) => (status === "paid" ? "pending" : status);

const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

export default function AdminDashboard() {
  const stopBookingPolling = useRef(false);
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("pending");
  const [deliveryBookings, setDeliveryBookings] = useState([]);
  const [riders, setRiders] = useState([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [ridersError, setRidersError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [actionError, setActionError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const loadBookings = useCallback(async (active = () => true) => {
    try {
      const response = await fetch("/api/delivery-bookings", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          stopBookingPolling.current = true;
        }
        throw new Error(result.message || "Could not load delivery requests.");
      }
      if (active()) {
        setDeliveryBookings(result.bookings);
        setBookingsError("");
      }
    } catch (error) {
      if (active()) {
        setBookingsError(
          error instanceof Error
            ? error.message
            : "Could not load delivery requests."
        );
      }
    } finally {
      if (active()) setBookingsLoading(false);
    }
  }, []);

  const loadRiders = useCallback(async (active = () => true) => {
    setRidersLoading(true);
    setRidersError("");
    try {
      const response = await fetch("/api/delivery-bookings/riders", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load rider accounts.");
      }
      if (active()) {
        setRiders(result.riders);
        setRidersError("");
      }
    } catch (error) {
      if (active()) {
        setRidersError(
          error instanceof Error ? error.message : "Could not load rider accounts."
        );
      }
    } finally {
      if (active()) setRidersLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    loadBookings(isActive);

    const refreshInterval = setInterval(() => {
      if (
        !stopBookingPolling.current &&
        document.visibilityState === "visible"
      ) {
        loadBookings(isActive);
      }
    }, 60000);
    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, [loadBookings]);

  const selectedBookingReference = selectedBooking?.reference;
  const selectedBookingStatus = selectedBooking?.status;

  useEffect(() => {
    if (
      !selectedBookingReference ||
      !["pending", "assigned"].includes(normalizeStatus(selectedBookingStatus))
    ) {
      return;
    }

    let active = true;
    loadRiders(() => active);
    return () => {
      active = false;
    };
  }, [loadRiders, selectedBookingReference, selectedBookingStatus]);

  const counts = useMemo(
    () =>
      deliveryBookings.reduce(
        (totals, booking) => {
          const status = normalizeStatus(booking.status);
          if (status in totals) totals[status] += 1;
          return totals;
        },
        { pending: 0, in_progress: 0, assigned: 0, completed: 0 }
      ),
    [deliveryBookings]
  );

  const visibleBookings = useMemo(() => {
    const search = query.trim().toLowerCase();
    return deliveryBookings
      .filter((booking) => normalizeStatus(booking.status) === activeStatus)
      .filter((booking) => {
        if (!search) return true;
        return [
          booking.reference,
          booking.sender?.name,
          booking.sender?.phone,
          booking.recipient?.name,
          booking.recipient?.phone,
          booking.pickup?.address,
          booking.delivery?.address,
          booking.parcel?.category,
          booking.parcel?.description,
          booking.rider?.name,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search));
      })
      .sort((left, right) => left.reference.localeCompare(right.reference));
  }, [activeStatus, deliveryBookings, query]);

  const activeRiders = riders.filter((rider) => rider.status === "active");

  const openBooking = (booking) => {
    setSelectedBooking(booking);
    setSelectedRiderId(booking.rider?.userId || "");
    setActionError("");
  };

  const updateBooking = async (action, extra = {}) => {
    if (!selectedBooking) return;
    setIsUpdating(true);
    setActionError("");
    try {
      const response = await fetch("/api/delivery-bookings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference: selectedBooking.reference,
          action,
          ...extra,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not update this order.");
      }

      const updatedBooking = { ...selectedBooking, ...result.booking };
      setDeliveryBookings((current) =>
        current.map((booking) =>
          booking.reference === updatedBooking.reference
            ? { ...booking, ...result.booking }
            : booking
        )
      );
      setSelectedBooking(updatedBooking);
      if (action === "assign") setSelectedRiderId(result.booking.rider.userId);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update this order."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <main className="admin-content">
      <header className="admin-topbar">
        <Link className="admin-topbar-mobile-brand" href="/" aria-label="AH Delivery home">
          <span className="admin-brand-mark">
            <FaShippingFast aria-hidden="true" />
          </span>
          AH Delivery
        </Link>
        <div className="admin-topbar-spacer" />
        <div className="admin-live-indicator">
          <span />
          Live delivery orders
        </div>
        <div className="admin-date-chip">
          <FaCalendarAlt aria-hidden="true" />
          {new Intl.DateTimeFormat("en", {
            month: "long",
            year: "numeric",
          }).format(new Date())}
        </div>
      </header>

      <section className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">OPERATIONS</p>
          <h1>Delivery orders</h1>
          <p className="admin-heading-description">
            Review paid bookings, assign riders, and track delivery progress.
          </p>
        </div>
        <label className="admin-search">
          <FaSearch aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference, customer, route"
            aria-label="Search delivery orders"
          />
        </label>
      </section>

      <section className="admin-stats" aria-label="Delivery order status totals">
        {statusGroups.map((group) => (
          <button
            aria-pressed={activeStatus === group.key}
            className={`admin-stat-card admin-stat-${group.key}${
              activeStatus === group.key ? " admin-stat-selected" : ""
            }`}
            key={group.key}
            onClick={() => setActiveStatus(group.key)}
            type="button"
          >
            <span className="admin-stat-count">{counts[group.key]}</span>
            <span className="admin-stat-label">{group.label}</span>
          </button>
        ))}
      </section>

      <section className="admin-orders-section">
        <div className="admin-orders-heading">
          <div>
            <h2>{statusGroups.find((group) => group.key === activeStatus)?.label} orders</h2>
            <p>
              {bookingsLoading
                ? "Loading saved requests…"
                : `${visibleBookings.length} order${visibleBookings.length === 1 ? "" : "s"} · sorted by reference`}
            </p>
          </div>
          <span className="admin-live-indicator">
            <span />
            MongoDB
          </span>
        </div>

        {bookingsError ? (
          <p className="admin-booking-error" role="alert">
            {bookingsError}
          </p>
        ) : visibleBookings.length ? (
          <div className="admin-order-grid">
            {visibleBookings.map((booking) => (
              <button
                className="admin-order-card admin-order-card-button"
                key={booking.reference}
                onClick={() => openBooking(booking)}
                type="button"
              >
                <span className="admin-order-card-top">
                  <span className={`order-status order-status-${normalizeStatus(booking.status)}`}>
                    <span />
                    {statusGroups.find(
                      (group) => group.key === normalizeStatus(booking.status)
                    )?.label || booking.status}
                  </span>
                  <span className="admin-order-date">
                    {formatDate(booking.createdAt)}
                  </span>
                </span>
                <span className="admin-booking-route">
                  <span>
                    <small>Pickup</small>
                    {booking.pickup?.address}
                  </span>
                  <FaArrowRight aria-hidden="true" />
                  <span>
                    <small>Delivery</small>
                    {booking.delivery?.address}
                  </span>
                </span>
                <span className="admin-order-details">
                  <span className="admin-customer">
                    <span className="admin-customer-avatar" aria-hidden="true">
                      {(booking.sender?.name || "C").charAt(0)}
                    </span>
                    <span>
                      <small>{booking.reference}</small>
                      <strong>{booking.sender?.name}</strong>
                    </span>
                  </span>
                  <span className="admin-order-total">
                    {currency}
                    {booking.quote?.amount?.toLocaleString()}
                  </span>
                </span>
                <span className="admin-order-items">
                  {booking.parcel?.category ||
                    booking.parcel?.description ||
                    "Parcel"}
                  {booking.rider?.name ? ` · Rider: ${booking.rider.name}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          !bookingsLoading && (
            <p className="admin-booking-empty">
              No {statusGroups.find((group) => group.key === activeStatus)?.label.toLowerCase()} orders found.
            </p>
          )
        )}
      </section>

      {selectedBooking && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdating) {
              setSelectedBooking(null);
            }
          }}
        >
          <section
            aria-labelledby="admin-booking-title"
            aria-modal="true"
            className="admin-booking-dialog"
            role="dialog"
          >
            <div className="admin-booking-dialog-heading">
              <div>
                <p className="admin-eyebrow">DELIVERY ORDER</p>
                <h2 id="admin-booking-title">{selectedBooking.reference}</h2>
              </div>
              <button
                aria-label="Close order details"
                className="admin-dialog-close"
                disabled={isUpdating}
                onClick={() => setSelectedBooking(null)}
                type="button"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="admin-booking-dialog-content">
              <p>
                <strong>Status:</strong>{" "}
                {statusGroups.find(
                  (group) =>
                    group.key === normalizeStatus(selectedBooking.status)
                )?.label || selectedBooking.status}
              </p>
              <p><strong>Booked:</strong> {formatDate(selectedBooking.createdAt)}</p>
              <div className="admin-booking-detail-grid">
                <div>
                  <h3>Sender</h3>
                  <p>{selectedBooking.sender?.name}</p>
                  <a href={`tel:${selectedBooking.sender?.phone}`}>
                    {selectedBooking.sender?.phone}
                  </a>
                </div>
                <div>
                  <h3>Recipient</h3>
                  <p>{selectedBooking.recipient?.name}</p>
                  <a href={`tel:${selectedBooking.recipient?.phone}`}>
                    {selectedBooking.recipient?.phone}
                  </a>
                </div>
                <div>
                  <h3>Pickup address</h3>
                  <p>{selectedBooking.pickup?.address}</p>
                </div>
                <div>
                  <h3>Delivery address</h3>
                  <p>{selectedBooking.delivery?.address}</p>
                </div>
                <div>
                  <h3>Package</h3>
                  <p>
                    {selectedBooking.parcel?.category || "Parcel"}
                    {selectedBooking.parcel?.description
                      ? ` — ${selectedBooking.parcel.description}`
                      : ""}
                  </p>
                  <small>
                    Declared value: {currency}
                    {(selectedBooking.parcel?.declaredValue || 0).toLocaleString()}
                  </small>
                </div>
                <div>
                  <h3>Delivery</h3>
                  <p>
                    {selectedBooking.direction === "receive"
                      ? "Receive"
                      : "Send"}{" "}
                    · {selectedBooking.vehicleType || "Motorbike"}
                  </p>
                </div>
                <div>
                  <h3>Payment</h3>
                  <p>
                    {currency}
                    {selectedBooking.quote?.amount?.toLocaleString()} ·{" "}
                    {selectedBooking.payment?.status}
                  </p>
                  <small>
                    Parcel requirements accepted:{" "}
                    {selectedBooking.parcel?.acceptedParcelRequirements
                      ? "Yes"
                      : "No"}
                  </small>
                </div>
              </div>

              {selectedBooking.rider && (
                <div className="admin-assigned-rider">
                  <h3>Assigned rider</h3>
                  <p>{selectedBooking.rider.name}</p>
                  {selectedBooking.rider.phone && (
                    <a href={`tel:${selectedBooking.rider.phone}`}>
                      {selectedBooking.rider.phone}
                    </a>
                  )}
                </div>
              )}

              {actionError && (
                <p className="admin-booking-error" role="alert">{actionError}</p>
              )}
              {ridersError &&
                ["pending", "assigned"].includes(
                  normalizeStatus(selectedBooking.status)
                ) && (
                  <p className="admin-booking-error" role="alert">
                    {ridersError}
                  </p>
                )}

              <div className="admin-booking-actions">
                {["pending", "assigned"].includes(
                  normalizeStatus(selectedBooking.status)
                ) && (
                  <>
                    <label>
                      Rider
                      <select
                        disabled={isUpdating || ridersLoading || activeRiders.length === 0}
                        onChange={(event) => setSelectedRiderId(event.target.value)}
                        value={selectedRiderId}
                      >
                        <option value="">
                          {ridersLoading ? "Loading riders…" : "Select a rider"}
                        </option>
                        {activeRiders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!ridersLoading && !activeRiders.length && !ridersError && (
                      <p className="admin-booking-empty">
                        No active rider accounts are available. Invite a rider
                        and have them complete account setup first.
                      </p>
                    )}
                    <button
                      className="admin-action-button"
                      disabled={isUpdating || !selectedRiderId}
                      onClick={() =>
                        updateBooking("assign", { riderId: selectedRiderId })
                      }
                      type="button"
                    >
                      {isUpdating ? "Saving…" : "Assign rider"}
                    </button>
                  </>
                )}
                {selectedBooking.status === "assigned" && (
                  <button
                    className="admin-action-button"
                    disabled={isUpdating}
                    onClick={() => updateBooking("start")}
                    type="button"
                  >
                    Start ride
                  </button>
                )}
                {selectedBooking.status === "in_progress" && (
                  <button
                    className="admin-action-button"
                    disabled={isUpdating}
                    onClick={() => updateBooking("complete")}
                    type="button"
                  >
                    Mark completed
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
