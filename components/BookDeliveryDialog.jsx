"use client";

import { useEffect, useRef, useState } from "react";
import { PARCEL_CATEGORIES } from "@/config/parcelCategories";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBriefcase,
  FaCrosshairs,
  FaHome,
  FaMapMarkerAlt,
  FaPlus,
  FaShippingFast,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

const DELIVERY_FEE_NGN = 5000;
const MAX_DELIVERIES = 20;
const recentAddresses = [
  {
    label: "Home",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    icon: FaHome,
  },
  {
    label: "Office",
    address: "24 Adeola Odeku Street, Victoria Island, Lagos",
    icon: FaBriefcase,
  },
];
const steps = ["sender", "deliveries", "review"];

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createDelivery = () => ({
  deliveryAddress: "",
  recipient: { name: "", phone: "" },
  parcel: {
    category: "",
    description: "",
    declaredValue: "",
    acceptedParcelRequirements: false,
  },
  paymentResponsibility: "sender",
});

function RoutePreview({ pickupAddress, deliveryAddress, compact = false }) {
  return (
    <div
      className={`booking-route-preview${compact ? " booking-route-compact" : ""}`}
      aria-label={`Route from ${pickupAddress} to ${deliveryAddress}`}
      role="img"
    >
      <div className="booking-route-grid" aria-hidden="true" />
      <svg
        className="booking-route-line"
        viewBox="0 0 360 150"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M24 113 C82 113 73 42 143 53 S221 127 268 88 S310 37 336 37" />
      </svg>
      <span className="booking-route-pin booking-route-pin-pickup">
        <FaMapMarkerAlt aria-hidden="true" />
      </span>
      <span className="booking-route-pin booking-route-pin-delivery">
        <FaMapMarkerAlt aria-hidden="true" />
      </span>
      <span className="booking-route-label booking-route-label-pickup">
        Pickup
      </span>
      <span className="booking-route-label booking-route-label-delivery">
        Delivery
      </span>
      <span className="booking-route-preview-caption">
        Route preview · Lagos coverage
      </span>
    </div>
  );
}

function AddressSummary({ label, address, icon: Icon, onEdit }) {
  return (
    <div className="booking-address-summary">
      <span className="booking-address-summary-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="booking-address-summary-copy">
        <small>{label}</small>
        <strong>{address || "Add an address"}</strong>
      </span>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit ${label}`}>
          Edit
        </button>
      )}
    </div>
  );
}

export default function BookDeliveryDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState(null);
  const [step, setStep] = useState("sender");
  const [pickupAddress, setPickupAddress] = useState("");
  const [sender, setSender] = useState({ name: "", phone: "" });
  const [deliveries, setDeliveries] = useState([createDelivery()]);
  const [locationMessage, setLocationMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const idempotencyKeyRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setDirection(null);
        setStep("sender");
        setLocationMessage("");
        setSubmitError("");
        idempotencyKeyRef.current = null;
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
        );
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (step === "sender") document.getElementById("sender-name")?.focus();
    if (step === "deliveries") {
      document.getElementById("delivery-recipient-name-0")?.focus();
    }
  }, [step]);

  const closeDialog = () => {
    setIsOpen(false);
    setDirection(null);
    setStep("sender");
    setLocationMessage("");
    setSubmitError("");
    idempotencyKeyRef.current = null;
  };

  const selectDirection = (selectedDirection) => {
    setDirection(selectedDirection);
    setStep("sender");
    setSubmitError("");
  };

  const chooseCurrentLocation = () => {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPickupAddress(
          `Current location (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`
        );
        idempotencyKeyRef.current = null;
        setLocationMessage(
          "Location captured. Add a nearby street or landmark in Lagos so the courier can find you."
        );
      },
      () => {
        setLocationMessage(
          "We couldn't access your location. Check your browser permission or enter the address."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updateSender = (field, value) => {
    idempotencyKeyRef.current = null;
    setSender((current) => ({ ...current, [field]: value }));
  };

  const updateDelivery = (index, updater) => {
    idempotencyKeyRef.current = null;
    setDeliveries((current) =>
      current.map((delivery, currentIndex) =>
        currentIndex === index ? updater(delivery) : delivery
      )
    );
  };

  const addDelivery = () => {
    idempotencyKeyRef.current = null;
    setDeliveries((current) => [...current, createDelivery()]);
  };

  const removeDelivery = (index) => {
    idempotencyKeyRef.current = null;
    setDeliveries((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const isSenderValid =
    pickupAddress.trim().length >= 5 &&
    sender.name.trim().length > 0 &&
    /^\+?[0-9\s()-]{7,30}$/.test(sender.phone.trim());
  const areDeliveriesValid =
    deliveries.length > 0 &&
    deliveries.every(
      (delivery) =>
        delivery.deliveryAddress.trim().length >= 5 &&
        delivery.recipient.name.trim().length > 0 &&
        /^\+?[0-9\s()-]{7,30}$/.test(delivery.recipient.phone.trim()) &&
        PARCEL_CATEGORIES.includes(delivery.parcel.category) &&
        (delivery.parcel.category !== "Other" ||
          delivery.parcel.description.trim()) &&
        (delivery.parcel.declaredValue === "" ||
          (Number.isInteger(Number(delivery.parcel.declaredValue)) &&
            Number(delivery.parcel.declaredValue) >= 0 &&
            Number(delivery.parcel.declaredValue) <= 45000)) &&
        delivery.parcel.acceptedParcelRequirements &&
        ["sender", "recipient"].includes(delivery.paymentResponsibility)
    );
  const amountDueNow =
    deliveries.filter(
      (delivery) => delivery.paymentResponsibility === "sender"
    ).length * DELIVERY_FEE_NGN;
  const amountDueOnDelivery =
    deliveries.filter(
      (delivery) => delivery.paymentResponsibility === "recipient"
    ).length * DELIVERY_FEE_NGN;
  const totalDeliveryFees = deliveries.length * DELIVERY_FEE_NGN;

  const handleCreateBooking = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (!isSenderValid || !areDeliveriesValid) {
      setSubmitError(
        "Check the sender details and make sure every delivery has a valid recipient, address, parcel type, and payment choice."
      );
      return;
    }

    setIsSubmitting(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const response = await fetch("/api/delivery-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          direction,
          pickupAddress,
          sender,
          deliveries: deliveries.map((delivery) => ({
            deliveryAddress: delivery.deliveryAddress,
            recipient: delivery.recipient,
            parcel: {
              ...delivery.parcel,
              declaredValue: delivery.parcel.declaredValue
                ? Number(delivery.parcel.declaredValue)
                : 0,
            },
            paymentResponsibility: delivery.paymentResponsibility,
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success || !result.batchReference) {
        throw new Error(result.message || "We couldn't save your delivery order.");
      }

      if (result.amountDueNow > 0) {
        window.location.assign(
          `/payment?batchReference=${encodeURIComponent(result.batchReference)}`
        );
      } else {
        window.location.assign(
          `/delivery-payment-complete?batchReference=${encodeURIComponent(result.batchReference)}`
        );
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't save your delivery order. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = steps.indexOf(step);

  return (
    <>
      <button
        className="button hero-primary-button"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="hero-primary-button-copy">
          <strong>Book a delivery</strong>
          <small>Send or receive</small>
        </span>
        <FaArrowRight aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="booking-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            ref={dialogRef}
            className={`booking-dialog${direction ? " booking-dialog-flow" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-dialog-title"
          >
            <button
              ref={closeButtonRef}
              className="booking-dialog-close"
              type="button"
              onClick={closeDialog}
              aria-label="Close booking dialog"
            >
              <FaTimes aria-hidden="true" />
            </button>

            {!direction ? (
              <div className="booking-choice">
                <span className="booking-dialog-brand-mark">
                  <FaShippingFast aria-hidden="true" />
                </span>
                <h2 id="booking-dialog-title">AH Delivery</h2>
                <p>Do you want to send or receive items?</p>
                <div className="booking-choice-actions">
                  <button
                    className="booking-choice-button booking-choice-primary"
                    type="button"
                    onClick={() => selectDirection("send")}
                  >
                    Send
                    <FaArrowRight aria-hidden="true" />
                  </button>
                  <button
                    className="booking-choice-button"
                    type="button"
                    onClick={() => selectDirection("receive")}
                  >
                    Receive
                    <FaArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="booking-flow-header">
                  <div className="booking-address-topline">
                    <button
                      className="booking-back-button"
                      type="button"
                      onClick={() => {
                        setSubmitError("");
                        if (stepIndex === 0) setDirection(null);
                        else setStep(steps[stepIndex - 1]);
                      }}
                    >
                      <FaArrowLeft aria-hidden="true" />
                      Back
                    </button>
                    <span className="eyebrow">AH DELIVERY</span>
                  </div>
                  <div className="booking-flow-progress" aria-label="Booking progress">
                    {steps.map((flowStep, index) => (
                      <span
                        className={
                          index <= stepIndex ? "booking-progress-active" : ""
                        }
                        key={flowStep}
                      />
                    ))}
                  </div>
                </div>

                {step === "sender" && (
                  <>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">Your details and pickup</h2>
                      <p>
                        Add your contact details and where the rider should
                        collect the parcel.
                      </p>
                    </div>
                    <div className="booking-review-card booking-sender-card">
                      <div className="booking-contact-grid">
                        <fieldset className="booking-contact-group">
                          <legend>
                            {direction === "send" ? "Your details" : "Sender"}
                          </legend>
                          <label htmlFor="sender-name">Full name</label>
                          <input
                            id="sender-name"
                            autoComplete="name"
                            value={sender.name}
                            onChange={(event) =>
                              updateSender("name", event.target.value)
                            }
                            required
                          />
                          <label htmlFor="sender-phone">Phone number</label>
                          <input
                            id="sender-phone"
                            autoComplete="tel"
                            type="tel"
                            value={sender.phone}
                            onChange={(event) =>
                              updateSender("phone", event.target.value)
                            }
                            required
                          />
                        </fieldset>
                        <div className="booking-contact-group">
                          <label htmlFor="booking-pickup">Pickup address</label>
                          <input
                            id="booking-pickup"
                            autoComplete="street-address"
                            placeholder="Street, area, Lagos"
                            value={pickupAddress}
                            onChange={(event) => {
                              idempotencyKeyRef.current = null;
                              setPickupAddress(event.target.value);
                            }}
                            required
                          />
                          <button
                            className="booking-current-location"
                            type="button"
                            onClick={chooseCurrentLocation}
                          >
                            <FaCrosshairs aria-hidden="true" />
                            Use current location
                          </button>
                          {locationMessage && (
                            <p className="booking-location-message" role="status">
                              {locationMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <aside className="booking-recent-addresses booking-recent-addresses-inline">
                      <h3>Previously used addresses</h3>
                      <p>Choose an address to fill in the pickup location.</p>
                      {recentAddresses.map(({ label, address, icon: Icon }) => (
                        <button
                          className="booking-saved-address"
                          key={label}
                          type="button"
                          onClick={() => {
                            idempotencyKeyRef.current = null;
                            setPickupAddress(address);
                          }}
                        >
                          <span className="booking-saved-address-icon">
                            <Icon aria-hidden="true" />
                          </span>
                          <span className="booking-saved-address-copy">
                            <strong>{label}</strong>
                            <small>{address}</small>
                          </span>
                          <span className="booking-saved-address-actions">
                            Use pickup
                          </span>
                        </button>
                      ))}
                    </aside>
                    <p className="booking-coverage-note">
                      For now, delivery requests are accepted within Lagos.
                    </p>
                    <div className="booking-flow-footer booking-flow-footer-split">
                      <span className="booking-flow-step-label">Step 1 of 3</span>
                      <button
                        className="button booking-next-button"
                        type="button"
                        disabled={!isSenderValid}
                        onClick={() => setStep("deliveries")}
                      >
                        Add delivery details
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}

                {step === "deliveries" && (
                  <>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">Who are we delivering to?</h2>
                      <p>
                        Add one recipient for each drop-off. Each delivery can
                        have its own payment choice.
                      </p>
                    </div>
                    {deliveries.map((delivery, index) => (
                      <article
                        className="booking-review-card booking-delivery-editor"
                        key={index}
                      >
                        <div className="booking-review-section-heading">
                          <h3>Delivery {index + 1}</h3>
                          {deliveries.length > 1 && (
                            <button
                              className="booking-remove-delivery"
                              type="button"
                              onClick={() => removeDelivery(index)}
                              aria-label={`Remove delivery ${index + 1}`}
                            >
                              <FaTrash aria-hidden="true" />
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="booking-contact-grid">
                          <fieldset className="booking-contact-group">
                            <legend>
                              {direction === "send" ? "Recipient" : "Your details"}
                            </legend>
                            <label htmlFor={`delivery-recipient-name-${index}`}>
                              Full name
                            </label>
                            <input
                              id={`delivery-recipient-name-${index}`}
                              autoComplete="name"
                              value={delivery.recipient.name}
                              onChange={(event) =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  recipient: {
                                    ...current.recipient,
                                    name: event.target.value,
                                  },
                                }))
                              }
                              required
                            />
                            <label htmlFor={`delivery-recipient-phone-${index}`}>
                              Phone number
                            </label>
                            <input
                              id={`delivery-recipient-phone-${index}`}
                              autoComplete="tel"
                              type="tel"
                              value={delivery.recipient.phone}
                              onChange={(event) =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  recipient: {
                                    ...current.recipient,
                                    phone: event.target.value,
                                  },
                                }))
                              }
                              required
                            />
                          </fieldset>
                          <div className="booking-contact-group">
                            <label htmlFor={`delivery-address-${index}`}>
                              Delivery address
                            </label>
                            <input
                              id={`delivery-address-${index}`}
                              autoComplete="street-address"
                              placeholder="Street, area, Lagos"
                              value={delivery.deliveryAddress}
                              onChange={(event) =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  deliveryAddress: event.target.value,
                                }))
                              }
                              required
                            />
                            <label
                              className="booking-field-label"
                              htmlFor={`parcel-category-${index}`}
                            >
                              Package type
                            </label>
                            <select
                              className="booking-wide-input"
                              id={`parcel-category-${index}`}
                              value={delivery.parcel.category}
                              onChange={(event) =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  parcel: {
                                    ...current.parcel,
                                    category: event.target.value,
                                  },
                                }))
                              }
                              required
                            >
                              <option value="" disabled>
                                Select a package type
                              </option>
                              {PARCEL_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            {delivery.parcel.category === "Other" && (
                              <>
                                <label
                                  className="booking-field-label"
                                  htmlFor={`parcel-description-${index}`}
                                >
                                  Describe the item
                                </label>
                                <textarea
                                  id={`parcel-description-${index}`}
                                  maxLength={300}
                                  placeholder="Briefly describe the item"
                                  value={delivery.parcel.description}
                                  onChange={(event) =>
                                    updateDelivery(index, (current) => ({
                                      ...current,
                                      parcel: {
                                        ...current.parcel,
                                        description: event.target.value,
                                      },
                                    }))
                                  }
                                  required
                                />
                              </>
                            )}
                            <label
                              className="booking-field-label"
                              htmlFor={`parcel-value-${index}`}
                            >
                              Item value (optional)
                            </label>
                            <input
                              className="booking-wide-input"
                              id={`parcel-value-${index}`}
                              type="number"
                              min="0"
                              max="45000"
                              step="1"
                              inputMode="numeric"
                              placeholder="₦"
                              value={delivery.parcel.declaredValue}
                              onChange={(event) =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  parcel: {
                                    ...current.parcel,
                                    declaredValue: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="booking-restricted-items">
                          <strong>Motorbike parcel requirements</strong>
                          <p>
                            Must fit in a backpack, be no larger than 60 × 40 ×
                            30 cm, weigh no more than 15 kg, and have a value of
                            ₦45,000 or less. Restricted or dangerous items
                            cannot be carried.
                          </p>
                          <label>
                            <input
                              type="checkbox"
                              checked={delivery.parcel.acceptedParcelRequirements}
                              onChange={(event) =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  parcel: {
                                    ...current.parcel,
                                    acceptedParcelRequirements:
                                      event.target.checked,
                                  },
                                }))
                              }
                            />
                            <span>
                              This parcel meets the size and weight limits and
                              contains no restricted items.
                            </span>
                          </label>
                        </div>
                        <fieldset className="booking-payment-options">
                          <legend>Who will pay the delivery fee?</legend>
                          <label>
                            <input
                              type="radio"
                              name={`payment-responsibility-${index}`}
                              checked={delivery.paymentResponsibility === "sender"}
                              onChange={() =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  paymentResponsibility: "sender",
                                }))
                              }
                            />
                            <span>
                              <strong>I’ll pay now</strong>
                              <small>Pay {`₦${DELIVERY_FEE_NGN.toLocaleString()}`} at checkout</small>
                            </span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`payment-responsibility-${index}`}
                              checked={delivery.paymentResponsibility === "recipient"}
                              onChange={() =>
                                updateDelivery(index, (current) => ({
                                  ...current,
                                  paymentResponsibility: "recipient",
                                }))
                              }
                            />
                            <span>
                              <strong>Recipient pays on delivery</strong>
                              <small>
                                {`₦${DELIVERY_FEE_NGN.toLocaleString()}`} due when
                                the parcel arrives; rider can also share a payment link
                              </small>
                            </span>
                          </label>
                        </fieldset>
                      </article>
                    ))}
                    {deliveries.length < MAX_DELIVERIES && (
                      <div className="booking-add-delivery-prompt">
                        <p>Sending to another person?</p>
                        <button
                          className="booking-add-delivery"
                          type="button"
                          onClick={addDelivery}
                        >
                          <FaPlus aria-hidden="true" />
                          Add another delivery
                        </button>
                      </div>
                    )}
                    <div className="booking-flow-footer booking-flow-footer-split">
                      <span className="booking-flow-step-label">
                        {deliveries.length} delivery{deliveries.length === 1 ? "" : "ies"}
                      </span>
                      <button
                        className="button booking-next-button"
                        type="button"
                        disabled={!areDeliveriesValid}
                        onClick={() => setStep("review")}
                      >
                        Review order
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}

                {step === "review" && (
                  <form className="booking-review" onSubmit={handleCreateBooking}>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">Review your order</h2>
                      <p>
                        Check each recipient and see what is payable now and on
                        delivery.
                      </p>
                    </div>
                    <div className="booking-review-card">
                      <AddressSummary
                        label="Pickup"
                        address={pickupAddress}
                        icon={FaShippingFast}
                        onEdit={() => setStep("sender")}
                      />
                      <p>
                        <strong>Sender:</strong> {sender.name} · {sender.phone}
                      </p>
                    </div>
                    {deliveries.map((delivery, index) => (
                      <div className="booking-review-card" key={index}>
                        <div className="booking-review-section-heading">
                          <h3>Delivery {index + 1} · {delivery.recipient.name}</h3>
                          <button
                            type="button"
                            onClick={() => setStep("deliveries")}
                          >
                            Edit
                          </button>
                        </div>
                        <RoutePreview
                          pickupAddress={pickupAddress}
                          deliveryAddress={delivery.deliveryAddress}
                          compact
                        />
                        <p>
                          <strong>Recipient:</strong> {delivery.recipient.name} ·{" "}
                          {delivery.recipient.phone}
                        </p>
                        <p>
                          <strong>Package:</strong>{" "}
                          {delivery.parcel.category}
                          {delivery.parcel.description
                            ? ` — ${delivery.parcel.description}`
                            : ""}
                        </p>
                        <p>
                          <strong>Delivery fee:</strong> ₦
                          {DELIVERY_FEE_NGN.toLocaleString()} ·{" "}
                          {delivery.paymentResponsibility === "sender"
                            ? "You pay now"
                            : "Recipient pays on delivery"}
                        </p>
                      </div>
                    ))}
                    <div className="booking-review-card booking-order-totals">
                      <h3>Payment summary</h3>
                      <p>
                        <span>Total delivery fees ({deliveries.length})</span>
                        <strong>₦{totalDeliveryFees.toLocaleString()}</strong>
                      </p>
                      <p>
                        <span>Pay now</span>
                        <strong>₦{amountDueNow.toLocaleString()}</strong>
                      </p>
                      <p>
                        <span>Due on delivery</span>
                        <strong>₦{amountDueOnDelivery.toLocaleString()}</strong>
                      </p>
                      <small>
                        Each recipient delivery will keep its own payment
                        status. Pay-on-delivery amounts can be paid to the rider
                        or by using a payment link shared by the rider.
                      </small>
                    </div>

                    {submitError && (
                      <p className="booking-submit-error" role="alert">
                        {submitError}
                      </p>
                    )}

                    <div className="booking-flow-footer booking-flow-footer-split">
                      <span className="booking-flow-step-label">Step 3 of 3</span>
                      <button
                        className="button booking-next-button"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting
                          ? "Saving order…"
                          : amountDueNow > 0
                            ? `Continue to payment · ₦${amountDueNow.toLocaleString()}`
                            : "Place order"}
                        {!isSubmitting && <FaArrowRight aria-hidden="true" />}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
