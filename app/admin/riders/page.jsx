"use client";

import { useCallback, useEffect, useState } from "react";
import { FaUserPlus } from "react-icons/fa";

export default function AdminRidersPage() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const loadRiders = useCallback(async () => {
    setLoading(true);
    setLoadingError("");
    try {
      const response = await fetch("/api/delivery-bookings/riders", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load rider accounts.");
      }
      setRiders(result.riders);
    } catch (error) {
      setLoadingError(
        error instanceof Error ? error.message : "Could not load rider accounts."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRiders();
  }, [loadRiders]);

  const submitRider = async (event) => {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/riders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not create this rider profile.");
      }

      setSuccess(`Rider profile created for ${result.rider.name}. No email was sent.`);
      setForm({ name: "", email: "", phone: "" });
      await loadRiders();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not create this rider profile."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-content">
      <header className="admin-topbar">
        <div className="admin-topbar-spacer" />
        <span className="admin-live-indicator">
          <span />
          Rider management
        </span>
      </header>

      <section className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">PEOPLE</p>
          <h1>Riders</h1>
          <p className="admin-heading-description">
            Create operational rider profiles for local delivery assignments.
          </p>
        </div>
      </section>

      <section className="rider-onboard-card" aria-labelledby="rider-onboard-title">
        <div className="rider-onboard-heading">
          <span className="rider-onboard-icon"><FaUserPlus aria-hidden="true" /></span>
          <div>
            <h2 id="rider-onboard-title">Onboard a rider</h2>
            <p>Creates a MongoDB rider profile only; no sign-in or email invitation is provided.</p>
          </div>
        </div>
        <form className="rider-onboard-form" onSubmit={submitRider}>
          <label>
            Full name
            <input
              autoComplete="name"
              maxLength={100}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              value={form.name}
            />
          </label>
          <label>
            Email address
            <input
              autoComplete="email"
              maxLength={254}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Phone number
            <input
              autoComplete="tel"
              maxLength={30}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              required
              type="tel"
              value={form.phone}
            />
          </label>
          {formError && <p className="rider-form-message rider-form-error" role="alert">{formError}</p>}
          {success && <p className="rider-form-message rider-form-success" role="status">{success}</p>}
          <button className="admin-action-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating profile…" : "Create rider profile"}
          </button>
        </form>
      </section>

      <section className="admin-orders-section" aria-labelledby="rider-list-title">
        <div className="admin-orders-heading">
          <div>
            <h2 id="rider-list-title">Rider accounts</h2>
            <p>
              {loading
                ? "Loading rider profiles…"
                : `${riders.filter((rider) => rider.status === "active").length} active · ${riders.filter((rider) => rider.status === "inactive").length} inactive`}
            </p>
          </div>
        </div>
        {loadingError ? (
          <p className="admin-booking-error" role="alert">{loadingError}</p>
        ) : riders.length ? (
          <div className="rider-list">
            {riders.map((rider) => (
              <article className="rider-list-item" key={rider.id}>
                <span className="admin-customer-avatar" aria-hidden="true">
                  {(rider.name || "R").charAt(0).toUpperCase()}
                </span>
                <div className="rider-list-details">
                  <strong>{rider.name}</strong>
                  <span>{rider.email}</span>
                </div>
                <span className="rider-list-phone">
                  {rider.phone || "No phone"}
                </span>
                <span className="rider-invitation-status">
                  {rider.status === "active" ? "Active" : "Inactive"}
                </span>
                <button
                  className="rider-portal-link"
                  disabled={loading}
                  onClick={async () => {
                    setLoadingError("");
                    try {
                      const response = await fetch("/api/admin/riders", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          riderId: rider.id,
                          status: rider.status === "active" ? "inactive" : "active",
                        }),
                      });
                      const result = await response.json();
                      if (!response.ok || !result.success) {
                        throw new Error(result.message || "Could not update rider status.");
                      }
                      setRiders((current) =>
                        current.map((item) => item.id === rider.id ? result.rider : item)
                      );
                    } catch (error) {
                      setLoadingError(
                        error instanceof Error ? error.message : "Could not update rider status."
                      );
                    }
                  }}
                  type="button"
                >
                  {rider.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          !loading && <p className="admin-booking-empty">No riders yet. Invite your first rider above.</p>
        )}
      </section>
    </main>
  );
}
