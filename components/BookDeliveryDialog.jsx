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
  FaMotorcycle,
  FaShippingFast,
  FaTimes,
} from "react-icons/fa";

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

const steps = ["addresses", "vehicle", "pickup", "review"];

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
  const [step, setStep] = useState("addresses");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [sender, setSender] = useState({ name: "", phone: "" });
  const [recipient, setRecipient] = useState({ name: "", phone: "" });
  const [parcelCategory, setParcelCategory] = useState("");
  const [parcelDescription, setParcelDescription] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [acceptedParcelRequirements, setAcceptedParcelRequirements] =
    useState(false);
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
        setStep("addresses");
        setLocationMessage("");
        setSubmitError("");
        idempotencyKeyRef.current = null;
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]'
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
    if (step === "addresses") {
      document.getElementById("booking-pickup")?.focus();
    }
  }, [step]);

  const closeDialog = () => {
    setIsOpen(false);
    setDirection(null);
    setStep("addresses");
    setLocationMessage("");
    setSubmitError("");
    idempotencyKeyRef.current = null;
  };

  const selectDirection = (selectedDirection) => {
    setDirection(selectedDirection);
    setStep("addresses");
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
        const address = `Current location (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`;
        if (direction === "receive") setDeliveryAddress(address);
        else setPickupAddress(address);
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

  const setRecentAddress = (address, field) => {
    if (field === "pickup") setPickupAddress(address);
    else setDeliveryAddress(address);
  };

  const updateContact = (contactType, field, value) => {
    const update = contactType === "sender" ? setSender : setRecipient;
    update((current) => ({ ...current, [field]: value }));
  };

  const isReviewValid = Boolean(
    sender.name.trim() &&
      /^\+?[0-9\s()-]{7,30}$/.test(sender.phone.trim()) &&
      recipient.name.trim() &&
      /^\+?[0-9\s()-]{7,30}$/.test(recipient.phone.trim()) &&
      PARCEL_CATEGORIES.includes(parcelCategory) &&
      (parcelCategory !== "Other" || parcelDescription.trim()) &&
      acceptedParcelRequirements &&
      (!declaredValue ||
        (Number.isInteger(Number(declaredValue)) &&
          Number(declaredValue) >= 0 &&
          Number(declaredValue) <= 45000))
  );

  const handleCreateBooking = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (!isReviewValid) {
      setSubmitError(
        "Enter both contact names and valid phone numbers, select a package type, describe it if you choose Other, confirm the parcel requirements, and check that any item value is a whole number from ₦0 to ₦45,000."
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
          deliveryAddress,
          sender,
          recipient,
          parcel: {
            category: parcelCategory,
            ...(parcelCategory === "Other"
              ? { description: parcelDescription }
              : {}),
            declaredValue: declaredValue ? Number(declaredValue) : 0,
            acceptedParcelRequirements,
          },
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success || !result.booking?.reference) {
        throw new Error(result.message || "We couldn't save your delivery request.");
      }

      window.location.assign(
        `/payment?deliveryBooking=${encodeURIComponent(result.booking.reference)}`
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't save your delivery request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = steps.indexOf(step);
  const confirmedSpotAddress =
    direction === "receive" ? deliveryAddress : pickupAddress;
  const isAddressValid =
    pickupAddress.trim().length >= 5 && deliveryAddress.trim().length >= 5;

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
                        setStep(
                          step === "addresses"
                            ? "addresses"
                            : steps[Math.max(0, stepIndex - 1)]
                        );
                        if (step === "addresses") setDirection(null);
                      }}
                    >
                      <FaArrowLeft aria-hidden="true" />
                      Back
                    </button>
                    <span className="eyebrow">AH DELIVERY</span>
                  </div>
                  <div className="booking-flow-progress" aria-label="Booking progress">
                    {["addresses", "vehicle", "pickup", "review"].map(
                      (flowStep, index) => (
                        <span
                          className={
                            index <= stepIndex ? "booking-progress-active" : ""
                          }
                          key={flowStep}
                        />
                      )
                    )}
                  </div>
                </div>

                {step === "addresses" && (
                  <>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">
                        {direction === "send" ? "Send an item" : "Receive an item"}
                      </h2>
                      <p>Add both locations to see your delivery options.</p>
                    </div>
                    <div className="booking-address-layout">
                      <div className="booking-address-column">
                        <div className="booking-address-card">
                          <label htmlFor="booking-pickup">
                            {direction === "send"
                              ? "Pickup address"
                              : "Sender's pickup address"}
                          </label>
                          <input
                            id="booking-pickup"
                            autoComplete="street-address"
                            placeholder="Street, area, Lagos"
                            value={pickupAddress}
                            onChange={(event) =>
                              setPickupAddress(event.target.value)
                            }
                          />
                          <span className="booking-address-divider" />
                          <label htmlFor="booking-delivery">
                            {direction === "send"
                              ? "Delivery address"
                              : "Your delivery address"}
                          </label>
                          <input
                            id="booking-delivery"
                            autoComplete="street-address"
                            placeholder="Street, area, Lagos"
                            value={deliveryAddress}
                            onChange={(event) =>
                              setDeliveryAddress(event.target.value)
                            }
                          />
                        </div>
                        <button
                          className="booking-current-location"
                          type="button"
                          onClick={chooseCurrentLocation}
                        >
                          <FaCrosshairs aria-hidden="true" />
                          Use current location for{" "}
                          {direction === "receive" ? "delivery" : "pickup"}
                        </button>
                        {locationMessage && (
                          <p className="booking-location-message" role="status">
                            {locationMessage}
                          </p>
                        )}
                        <p className="booking-coverage-note">
                          For now, delivery requests are accepted within Lagos.
                        </p>
                      </div>
                      <aside className="booking-recent-addresses">
                        <h3>Previously used addresses</h3>
                        <p>Demo addresses for preview</p>
                        {recentAddresses.map(({ label, address, icon: Icon }) => (
                          <div className="booking-saved-address" key={label}>
                            <span className="booking-saved-address-icon">
                              <Icon aria-hidden="true" />
                            </span>
                            <span className="booking-saved-address-copy">
                              <strong>{label}</strong>
                              <small>{address}</small>
                            </span>
                            <div className="booking-saved-address-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  setRecentAddress(address, "pickup")
                                }
                              >
                                Pickup
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRecentAddress(address, "delivery")
                                }
                              >
                                Delivery
                              </button>
                            </div>
                          </div>
                        ))}
                      </aside>
                    </div>
                    <div className="booking-flow-footer">
                      <button
                        className="button booking-next-button"
                        type="button"
                        disabled={!isAddressValid}
                        onClick={() => setStep("vehicle")}
                      >
                        See delivery options
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}

                {step === "vehicle" && (
                  <>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">Choose a delivery option</h2>
                      <p>Available for your Lagos delivery.</p>
                    </div>
                    <RoutePreview
                      pickupAddress={pickupAddress}
                      deliveryAddress={deliveryAddress}
                    />
                    <article
                      className="booking-vehicle-card booking-vehicle-selected"
                      aria-label="Send Motorbike selected, demo estimate 5,500 naira"
                    >
                      <span className="booking-vehicle-icon">
                        <FaMotorcycle aria-hidden="true" />
                      </span>
                      <span className="booking-vehicle-copy">
                        <strong>Send Motorbike</strong>
                        <small>For small items · Motorbike courier</small>
                      </span>
                      <span className="booking-vehicle-price">
                        <strong>₦5,500</strong>
                        <small>Delivery fee</small>
                      </span>
                    </article>
                    <p className="booking-demo-warning">
                      The delivery fee is payable online before your request is
                      sent to our operations team.
                    </p>
                    <div className="booking-flow-footer booking-flow-footer-split">
                      <span className="booking-flow-step-label">Step 2 of 4</span>
                      <button
                        className="button booking-next-button"
                        type="button"
                        onClick={() => setStep("pickup")}
                      >
                        Confirm pickup spot
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}

                {step === "pickup" && (
                  <>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">
                        Confirm {direction === "receive" ? "delivery" : "pickup"} spot
                      </h2>
                      <p>
                        Check that the courier can find this{" "}
                        {direction === "receive" ? "delivery" : "pickup"} location.
                      </p>
                    </div>
                    <RoutePreview
                      pickupAddress={pickupAddress}
                      deliveryAddress={deliveryAddress}
                      compact
                    />
                    <label className="booking-field-label" htmlFor="confirm-spot">
                      {direction === "receive" ? "Delivery address" : "Pickup address"}
                    </label>
                    <input
                      className="booking-wide-input"
                      id="confirm-spot"
                      autoComplete="street-address"
                      value={confirmedSpotAddress}
                      onChange={(event) => {
                        if (direction === "receive") {
                          setDeliveryAddress(event.target.value);
                        } else {
                          setPickupAddress(event.target.value);
                        }
                      }}
                    />
                    <button
                      className="booking-current-location"
                      type="button"
                      onClick={chooseCurrentLocation}
                    >
                      <FaCrosshairs aria-hidden="true" />
                      Set {direction === "receive" ? "delivery" : "pickup"} to current location
                    </button>
                    {locationMessage && (
                      <p className="booking-location-message" role="status">
                        {locationMessage}
                      </p>
                    )}
                    <div className="booking-flow-footer booking-flow-footer-split">
                      <span className="booking-flow-step-label">Step 3 of 4</span>
                      <button
                        className="button booking-next-button"
                        type="button"
                        disabled={confirmedSpotAddress.trim().length < 5}
                        onClick={() => setStep("review")}
                      >
                        Review delivery
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}

                {step === "review" && (
                  <form className="booking-review" onSubmit={handleCreateBooking}>
                    <div className="booking-address-heading">
                      <h2 id="booking-dialog-title">Review delivery</h2>
                      <p>Check the details before sending your request.</p>
                    </div>
                    <div className="booking-review-card">
                      <RoutePreview
                        pickupAddress={pickupAddress}
                        deliveryAddress={deliveryAddress}
                        compact
                      />
                      <AddressSummary
                        label="Pickup"
                        address={pickupAddress}
                        icon={FaShippingFast}
                        onEdit={() => setStep("addresses")}
                      />
                      <AddressSummary
                        label="Delivery"
                        address={deliveryAddress}
                        icon={FaMapMarkerAlt}
                        onEdit={() => setStep("addresses")}
                      />
                    </div>

                    <div className="booking-review-card">
                      <div className="booking-review-section-heading">
                        <h3>Contact details</h3>
                        <span>Required for pickup and delivery</span>
                      </div>
                      <div className="booking-contact-grid">
                        <fieldset className="booking-contact-group">
                          <legend>
                            {direction === "send" ? "Your details" : "Sender"}
                          </legend>
                          <label htmlFor="sender-name">Name</label>
                          <input
                            id="sender-name"
                            autoComplete="name"
                            value={sender.name}
                            onChange={(event) =>
                              updateContact("sender", "name", event.target.value)
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
                              updateContact("sender", "phone", event.target.value)
                            }
                            required
                          />
                        </fieldset>
                        <fieldset className="booking-contact-group">
                          <legend>
                            {direction === "send" ? "Recipient" : "Your details"}
                          </legend>
                          <label htmlFor="recipient-name">Name</label>
                          <input
                            id="recipient-name"
                            autoComplete="name"
                            value={recipient.name}
                            onChange={(event) =>
                              updateContact(
                                "recipient",
                                "name",
                                event.target.value
                              )
                            }
                            required
                          />
                          <label htmlFor="recipient-phone">Phone number</label>
                          <input
                            id="recipient-phone"
                            autoComplete="tel"
                            type="tel"
                            value={recipient.phone}
                            onChange={(event) =>
                              updateContact(
                                "recipient",
                                "phone",
                                event.target.value
                              )
                            }
                            required
                          />
                        </fieldset>
                      </div>
                    </div>

                    <div className="booking-review-card">
                      <div className="booking-review-section-heading">
                        <h3>Parcel details</h3>
                        <span>Motorbike · small items</span>
                      </div>
                      <label className="booking-field-label" htmlFor="parcel-category">
                        Package type
                      </label>
                      <select
                        className="booking-wide-input"
                        id="parcel-category"
                        value={parcelCategory}
                        onChange={(event) => setParcelCategory(event.target.value)}
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
                      {parcelCategory === "Other" && (
                        <>
                          <label
                            className="booking-field-label"
                            htmlFor="parcel-description"
                          >
                            Describe the item
                          </label>
                          <textarea
                            id="parcel-description"
                            maxLength={300}
                            placeholder="Briefly describe the item"
                            value={parcelDescription}
                            onChange={(event) =>
                              setParcelDescription(event.target.value)
                            }
                            required
                          />
                        </>
                      )}
                      <label className="booking-field-label" htmlFor="parcel-value">
                        Item value (optional)
                      </label>
                      <input
                        className="booking-wide-input"
                        id="parcel-value"
                        type="number"
                        min="0"
                        max="45000"
                        step="1"
                        inputMode="numeric"
                        placeholder="₦"
                        value={declaredValue}
                        onChange={(event) => setDeclaredValue(event.target.value)}
                      />
                      <div className="booking-restricted-items">
                        <strong>Motorbike parcel requirements</strong>
                        <p>
                          Must fit in a backpack, be no larger than 60 × 40 × 30
                          cm, weigh no more than 15 kg, and have a value of
                          ₦45,000 or less. We cannot carry drugs, alcohol,
                          firearms, weapons, illegal or dangerous items, or
                          prescription medicines.
                        </p>
                        <label>
                          <input
                            type="checkbox"
                            checked={acceptedParcelRequirements}
                            onChange={(event) =>
                              setAcceptedParcelRequirements(event.target.checked)
                            }
                          />
                          <span>
                            My parcel meets these size and weight limits and
                            contains no restricted items.
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="booking-review-card booking-payment-card">
                      <div>
                        <small>Payment method</small>
                        <strong>Online payment</strong>
                      </div>
                      <div className="booking-payment-amount">
                        <small>Delivery fee</small>
                        <strong>₦5,500</strong>
                      </div>
                      <p>
                        Pay securely online. Your request will be sent to our
                        operations team after payment is confirmed.
                      </p>
                    </div>

                    {submitError && (
                      <p className="booking-submit-error" role="alert">
                        {submitError}
                      </p>
                    )}

                    <div className="booking-flow-footer booking-flow-footer-split">
                      <span className="booking-flow-step-label">Step 4 of 4</span>
                      <button
                        className="button booking-next-button"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Saving request…" : "Continue to payment"}
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
