"use client";

import { useCallback, useEffect, useState } from "react";
import { FaUserPlus } from "react-icons/fa";
import RiderOnboardingWizard from "@/components/admin/RiderOnboardingWizard";

export default function AdminRidersPage() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardRiderId, setWizardRiderId] = useState("");

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

  const updateSavedRider = (updatedRider) => {
    setRiders((current) => {
      const exists = current.some((rider) => rider.id === updatedRider.id);
      if (exists) {
        return current.map((rider) =>
          rider.id === updatedRider.id ? { ...rider, ...updatedRider } : rider
        );
      }
      return [...current, updatedRider].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    });
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
            Manage your riders and track onboarding progress.
          </p>
        </div>
        <button
          className="admin-action-button rider-onboard-trigger"
          onClick={() => {
            setWizardRiderId("");
            setWizardOpen(true);
          }}
          type="button"
        >
          <FaUserPlus aria-hidden="true" />
          Onboard a rider
        </button>
      </section>

      {wizardOpen && (
        <RiderOnboardingWizard
          key={wizardRiderId || "new"}
          onClose={() => {
            setWizardOpen(false);
            setWizardRiderId("");
          }}
          onSaved={updateSavedRider}
          riderId={wizardRiderId}
        />
      )}

      <section className="admin-orders-section" aria-labelledby="rider-list-title">
        <div className="admin-orders-heading">
          <div>
            <h2 id="rider-list-title">Rider accounts</h2>
            <p>
              {loading
                ? "Loading rider profiles…"
                : `${riders.length} riders · ${riders.filter((rider) => rider.status === "active").length} active · ${riders.filter((rider) => rider.status === "inactive").length} inactive`}
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
                  <div className="rider-progress">
                    <div className="rider-progress-label">
                      <span>Onboarding</span>
                      <strong>{rider.onboardingProgress}%</strong>
                    </div>
                    <div
                      aria-label={`Onboarding ${rider.onboardingProgress}% complete`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={rider.onboardingProgress}
                      className="rider-progress-track"
                      role="progressbar"
                    >
                      <span style={{ width: `${rider.onboardingProgress}%` }} />
                    </div>
                  </div>
                </div>
                <span className="rider-list-phone">
                  {rider.phone || "No phone"}
                </span>
                <span className="rider-invitation-status">
                  {rider.status === "active" ? "Active" : "Inactive"}
                </span>
                <button
                  className="rider-list-action"
                  onClick={() => {
                    setWizardRiderId(rider.id);
                    setWizardOpen(true);
                  }}
                  type="button"
                >
                  {rider.onboardingProgress < 100 ? "Continue onboarding" : "Edit profile"}
                </button>
                <button
                  className="rider-list-action rider-list-status-action"
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
          !loading && <p className="admin-booking-empty">No riders yet. Use “Onboard a rider” to add your first rider.</p>
        )}
      </section>
    </main>
  );
}
