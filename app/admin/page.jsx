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
import { DELIVERY_HUBS, getDeliveryHubLabel } from "@/config/deliveryHubs";

const statusGroups = [
  { key: "pending_payment", label: "Awaiting payment" },
  { key: "pending", label: "Pending" },
  { key: "assigned", label: "Assigned" },
  { key: "in_transit", label: "In transit" },
  { key: "at_hub", label: "At hub · Awaiting final delivery" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const currency = process.env.NEXT_PUBLIC_CURRENCY || "₦";

const normalizeStatus = (status) => {
  if (status === "paid") return "pending";
  if (status === "in_progress") return "in_transit";
  return status;
};

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
  const [deliveryType, setDeliveryType] = useState("direct");
  const [hubLocation, setHubLocation] = useState("yaba");
  const [completedDistanceKm, setCompletedDistanceKm] = useState("");
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
      !["pending", "assigned", "in_transit", "at_hub"].includes(
        normalizeStatus(selectedBookingStatus)
      )
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
        {
          pending_payment: 0,
          pending: 0,
          assigned: 0,
          in_transit: 0,
          at_hub: 0,
          completed: 0,
          cancelled: 0,
        }
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
          booking.batchReference,
          booking.sender?.name,
          booking.sender?.phone,
          booking.recipient?.name,
          booking.recipient?.phone,
          booking.pickup?.address,
          booking.delivery?.address,
          booking.parcel?.category,
          booking.parcel?.description,
          booking.rider?.name,
          booking.payment?.status,
          booking.payment?.responsibility,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search));
      })
      .sort((left, right) => left.reference.localeCompare(right.reference));
  }, [activeStatus, deliveryBookings, query]);

  const visibleBatchGroups = useMemo(() => {
    const groups = new Map();
    visibleBookings.forEach((booking) => {
      const batchReference = booking.batchReference || booking.reference;
      if (!groups.has(batchReference)) {
        const allDeliveries = deliveryBookings.filter(
          (item) => (item.batchReference || item.reference) === batchReference
        );
        groups.set(batchReference, {
          reference: batchReference,
          allDeliveries,
          visibleDeliveries: [],
        });
      }
      groups.get(batchReference).visibleDeliveries.push(booking);
    });
    return Array.from(groups.values());
  }, [deliveryBookings, visibleBookings]);

  const activeRiders = riders.filter((rider) => rider.status === "active");
  const routeNeedsSave =
    selectedBooking &&
    (deliveryType !== (selectedBooking.deliveryType || "direct") ||
      (deliveryType === "hub" &&
        hubLocation !== (selectedBooking.hubLocation || "")));

  const openBooking = (booking) => {
    setSelectedBooking(booking);
    setSelectedRiderId(
      ["assigned", "in_transit"].includes(normalizeStatus(booking.status))
        ? ""
        : booking.rider?.userId || ""
    );
    setDeliveryType(booking.deliveryType || "direct");
    setHubLocation(booking.hubLocation || "yaba");
    setCompletedDistanceKm("");
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
      if (action === "complete") setCompletedDistanceKm("");
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
            Review orders, assign riders, and track each delivery and payment.
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
        <div className="admin-batch-list">
          {visibleBatchGroups.map((group) => {
            const totalFees = group.allDeliveries.reduce(
              (total, booking) => total + (booking.quote?.amount || 0),
              0
            );
            const amountPaid = group.allDeliveries
              .filter((booking) =>
                ["paid", "collected"].includes(booking.payment?.status)
              )
              .reduce(
                (total, booking) => total + (booking.quote?.amount || 0),
                0
              );
            const awaitingPayment = group.allDeliveries
              .filter((booking) => booking.payment?.status === "pending")
              .reduce(
                (total, booking) => total + (booking.quote?.amount || 0),
                0
              );
            const dueOnDelivery = group.allDeliveries
              .filter((booking) => booking.payment?.status === "due_on_delivery")
              .reduce(
                (total, booking) => total + (booking.quote?.amount || 0),
                0
              );

            return (
              <section className="admin-batch-group" key={group.reference}>
                <header className="admin-batch-heading">
                  <div>
                    <p className="admin-eyebrow">ORDER GROUP</p>
                    <h3>{group.reference}</h3>
                    <small>
                      Showing {group.visibleDeliveries.length} of{" "}
                      {group.allDeliveries.length} deliveries
                    </small>
                  </div>
                  <div className="admin-batch-totals">
                    <span>
                      Total <strong>{currency}{totalFees.toLocaleString()}</strong>
                    </span>
                    <span>
                      Paid <strong>{currency}{amountPaid.toLocaleString()}</strong>
                    </span>
                    <span>
                      Awaiting payment <strong>{currency}{awaitingPayment.toLocaleString()}</strong>
                    </span>
                    <span>
                      POD due <strong>{currency}{dueOnDelivery.toLocaleString()}</strong>
                    </span>
                  </div>
                </header>
                <div className="admin-order-grid">
                  {group.visibleDeliveries.map((booking) => {
                    const paymentStatus = booking.payment?.status || "not_started";
                    const paymentStatusLabel =
                      paymentStatus === "paid"
                        ? "Paid"
                        : paymentStatus === "collected"
                          ? "Collected by rider"
                          : paymentStatus === "due_on_delivery"
                            ? "Due on delivery"
                            : paymentStatus === "pending"
                              ? "Awaiting payment"
                              : paymentStatus.replaceAll("_", " ");
                    return (
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
                        {booking.batchSize > 1
                          ? ` · Delivery ${(booking.batchIndex || 0) + 1} of ${booking.batchSize}`
                          : ""}
                        {booking.deliveryType === "hub"
                          ? ` · ${getDeliveryHubLabel(booking.hubLocation) || "Hub sorting"}`
                          : " · Direct delivery"}
                        {booking.rider?.name ? ` · Rider: ${booking.rider.name}` : ""}
                        <span
                          className={`admin-payment-status admin-payment-status-${paymentStatus}`}
                        >
                          {booking.payment?.responsibility === "recipient"
                            ? "Recipient"
                            : "Sender"}{" "}
                          · {paymentStatusLabel}
                        </span>
                      </span>
                      </button>
                    );
                  })}
                  </div>
                </section>
              );
            })}
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
                  <small>
                    Route:{" "}
                    {selectedBooking.deliveryType === "hub"
                      ? "Bring to hub"
                      : "Direct delivery"}
                    {selectedBooking.currentLeg === "to_hub"
                      ? " · First leg to hub"
                      : selectedBooking.currentLeg === "final_delivery"
                        ? " · Final delivery leg"
                        : ""}
                  </small>
                  {selectedBooking.deliveryType === "hub" && (
                    <p>
                      <strong>Hub:</strong>{" "}
                      {getDeliveryHubLabel(selectedBooking.hubLocation) ||
                        selectedBooking.hubAddress}
                    </p>
                  )}
                </div>
                <div>
                  <h3>Payment</h3>
                  <p>
                    {currency}
                    {selectedBooking.quote?.amount?.toLocaleString()} ·{" "}
                    {selectedBooking.payment?.responsibility === "recipient"
                      ? "Recipient pays"
                      : "Sender pays"}
                  </p>
                  <small>
                    Payment status:{" "}
                    {selectedBooking.payment?.status === "paid"
                      ? "Paid"
                      : selectedBooking.payment?.status === "pending"
                        ? "Awaiting payment"
                        : selectedBooking.payment?.status === "due_on_delivery"
                          ? "Due on delivery"
                          : selectedBooking.payment?.status === "collected"
                            ? "Collected by rider"
                            : selectedBooking.payment?.status}
                  </small>
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
              {selectedBooking.riderAssignmentHistory?.length > 1 && (
                <div className="admin-assigned-rider">
                  <h3>Assignment history</h3>
                  {selectedBooking.riderAssignmentHistory.map((assignment, index) => (
                    <p key={`${assignment.userId}-${assignment.assignedAt}-${index}`}>
                      {assignment.name} ·{" "}
                      {assignment.leg === "to_hub"
                        ? "Hub leg"
                        : assignment.leg === "final_delivery"
                          ? "Final delivery"
                          : "Direct delivery"}{" "}
                      · {formatDate(assignment.assignedAt)}
                    </p>
                  ))}
                </div>
              )}

              {actionError && (
                <p className="admin-booking-error" role="alert">{actionError}</p>
              )}
              {ridersError &&
                ["pending", "assigned", "in_transit", "at_hub"].includes(
                  normalizeStatus(selectedBooking.status)
                ) && (
                  <p className="admin-booking-error" role="alert">
                    {ridersError}
                  </p>
                )}

              <div className="admin-booking-actions">
                {normalizeStatus(selectedBooking.status) === "pending" && (
                  <>
                    <label className="admin-route-type-field">
                      Delivery route
                      <select
                        disabled={isUpdating}
                        onChange={(event) => setDeliveryType(event.target.value)}
                        value={deliveryType}
                      >
                        <option value="direct">Direct to recipient</option>
                        <option value="hub">Bring to hub for sorting</option>
                      </select>
                    </label>
                    {deliveryType === "hub" && (
                      <label className="admin-route-type-field admin-hub-location-field">
                        Hub location
                        <select
                          disabled={isUpdating}
                          onChange={(event) => setHubLocation(event.target.value)}
                          value={hubLocation}
                        >
                          {DELIVERY_HUBS.map((hub) => (
                            <option key={hub.value} value={hub.value}>
                              {hub.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      className="admin-action-button admin-secondary-action"
                      disabled={isUpdating}
                      onClick={() =>
                        updateBooking("set_delivery_type", {
                          deliveryType,
                          hubLocation,
                        })
                      }
                      type="button"
                    >
                      {isUpdating ? "Saving…" : "Save delivery route"}
                    </button>
                  </>
                )}
                {["pending", "assigned", "in_transit", "at_hub"].includes(
                  normalizeStatus(selectedBooking.status)
                ) && (
                  <>
                    <label>
                      {normalizeStatus(selectedBooking.status) === "at_hub"
                        ? "Final-delivery rider"
                        : selectedBooking.status === "in_transit"
                          ? "Reassign to rider"
                          : selectedBooking.status === "assigned"
                            ? "Reassign rider"
                            : "Rider"}
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
                      disabled={
                        isUpdating ||
                        !selectedRiderId ||
                        (normalizeStatus(selectedBooking.status) === "pending" &&
                          routeNeedsSave)
                      }
                      onClick={() =>
                        updateBooking("assign", { riderId: selectedRiderId })
                      }
                      type="button"
                    >
                      {isUpdating
                        ? "Saving…"
                        : normalizeStatus(selectedBooking.status) === "at_hub"
                          ? "Assign final delivery"
                          : ["assigned", "in_transit"].includes(
                              normalizeStatus(selectedBooking.status)
                            )
                            ? "Reassign rider"
                            : "Assign rider"}
                    </button>
                  </>
                )}
                {normalizeStatus(selectedBooking.status) === "assigned" && (
                  <button
                    className="admin-action-button"
                    disabled={isUpdating}
                    onClick={() => updateBooking("start")}
                    type="button"
                  >
                    Start ride
                  </button>
                )}
                {normalizeStatus(selectedBooking.status) === "in_transit" &&
                  selectedBooking.currentLeg === "to_hub" && (
                    <button
                      className="admin-action-button"
                      disabled={isUpdating}
                      onClick={() => updateBooking("arrive_hub")}
                      type="button"
                    >
                      Confirm received at hub
                    </button>
                  )}
                {normalizeStatus(selectedBooking.status) === "in_transit" &&
                  selectedBooking.currentLeg !== "to_hub" && (
                  <>
                    <label className="admin-route-type-field admin-distance-field">
                      Trip distance (km)
                      <input
                        disabled={isUpdating}
                        max="1000"
                        min="0"
                        onChange={(event) =>
                          setCompletedDistanceKm(event.target.value)
                        }
                        placeholder="e.g. 8.5"
                        step="0.1"
                        type="number"
                        value={completedDistanceKm}
                      />
                    </label>
                    <button
                      className="admin-action-button"
                      disabled={
                        isUpdating ||
                        completedDistanceKm === "" ||
                        !Number.isFinite(Number(completedDistanceKm)) ||
                        Number(completedDistanceKm) < 0 ||
                        Number(completedDistanceKm) > 1000
                      }
                      onClick={() =>
                        updateBooking("complete", {
                          distanceKm: Number(completedDistanceKm),
                        })
                      }
                      type="button"
                    >
                      {isUpdating ? "Saving…" : "Record distance & mark completed"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
