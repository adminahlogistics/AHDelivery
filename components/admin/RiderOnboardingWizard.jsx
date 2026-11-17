"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { title: "Contact details", description: "Basic rider information" },
  { title: "Address", description: "Home address and proof" },
  { title: "Identity", description: "BVN and NIN" },
  { title: "Review", description: "Confirm onboarding details" },
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  bvn: "",
  nin: "",
};

export default function RiderOnboardingWizard({ riderId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(riderId ? 5 : 0);
  const [activeRiderId, setActiveRiderId] = useState(riderId || "");
  const [proofFile, setProofFile] = useState(null);
  const [ninSlipFile, setNinSlipFile] = useState(null);
  const [savedProof, setSavedProof] = useState(null);
  const [savedNinSlip, setSavedNinSlip] = useState(null);
  const [savedIdentity, setSavedIdentity] = useState({
    hasBvn: false,
    bvnLastFour: "",
    hasNin: false,
    ninLastFour: "",
  });
  const [loading, setLoading] = useState(Boolean(riderId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!riderId) return undefined;

    let active = true;
    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/admin/riders/${riderId}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load rider details.");
        }
        if (!active) return;

        setForm({
          name: result.profile.name,
          email: result.profile.email,
          phone: result.profile.phone,
          address: result.profile.address,
          bvn: "",
          nin: "",
        });
        setSavedProof(result.profile.proofOfAddress);
        setSavedNinSlip(result.profile.ninSlip);
        setProgress(result.profile.onboardingProgress);
        setSavedIdentity({
          hasBvn: result.profile.hasBvn,
          bvnLastFour: result.profile.bvnLastFour,
          hasNin: result.profile.hasNin,
          ninLastFour: result.profile.ninLastFour,
        });
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load rider details."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [riderId]);

  const saveStep = async (direction = 1) => {
    if (step === 3) {
      if (direction > 0) onClose();
      else setStep(2);
      return;
    }

    setError("");
    setSaving(true);
    try {
      let response;
      if (step === 0 && !activeRiderId) {
        response = await fetch("/api/admin/riders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
          }),
        });
      } else {
        const body = new FormData();
        body.append("name", form.name);
        body.append("email", form.email);
        body.append("phone", form.phone);
        body.append("address", form.address);
        body.append("bvn", form.bvn);
        body.append("nin", form.nin);
        if (proofFile) body.append("proofOfAddress", proofFile);
        if (ninSlipFile) body.append("ninSlip", ninSlipFile);

        response = await fetch(`/api/admin/riders/${activeRiderId}`, {
          method: "PATCH",
          body,
        });
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not save rider details.");
      }

      const savedRider = result.rider;
      const savedRiderId = savedRider.id || activeRiderId;
      setActiveRiderId(savedRiderId);
      onSaved(savedRider);
      setProgress(savedRider.onboardingProgress);
      setProofFile(null);
      setNinSlipFile(null);
      if (step === 2) {
        setForm((current) => ({ ...current, bvn: "", nin: "" }));
      }
      if (step === 1 || step === 2) {
        const profileResponse = await fetch(
          `/api/admin/riders/${savedRiderId}`,
          { cache: "no-store" }
        );
        const profileResult = await profileResponse.json();
        if (!profileResponse.ok || !profileResult.success) {
          throw new Error(profileResult.message || "Could not reload rider details.");
        }
        setSavedProof(profileResult.profile.proofOfAddress);
        setSavedNinSlip(profileResult.profile.ninSlip);
        setSavedIdentity({
          hasBvn: profileResult.profile.hasBvn,
          bvnLastFour: profileResult.profile.bvnLastFour,
          hasNin: profileResult.profile.hasNin,
          ninLastFour: profileResult.profile.ninLastFour,
        });
      }
      setStep((current) => current + direction);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save rider details."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rider-onboard-card rider-wizard" aria-labelledby="rider-wizard-title">
      <header className="rider-wizard-header">
        <div>
          <p className="admin-eyebrow">RIDER ONBOARDING</p>
          <h2 id="rider-wizard-title">
            {riderId ? `Complete ${form.name || "rider"}’s profile` : "Onboard a rider"}
          </h2>
          <p>Save each step as you go. Previously saved steps stay on the rider profile.</p>
        </div>
        <button className="rider-wizard-close" onClick={onClose} type="button">
          Close
        </button>
      </header>

      <nav className="rider-wizard-steps" aria-label="Onboarding progress">
        {STEPS.map((item, index) => (
          <div
            className={`rider-wizard-step${index === step ? " rider-wizard-step-current" : ""}${index < step ? " rider-wizard-step-done" : ""}`}
            key={item.title}
          >
            <span>{index < step ? "✓" : index + 1}</span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </div>
          </div>
        ))}
      </nav>

      {loading ? (
        <p className="admin-booking-empty">Loading rider details…</p>
      ) : (
        <form
          className="rider-wizard-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveStep();
          }}
        >
          <div className="rider-wizard-stage">
            {step === 0 && (
              <>
                <div className="rider-wizard-stage-heading">
                  <h3>Contact details</h3>
                  <p>A rider is added to your list as soon as these details are saved.</p>
                </div>
                <div className="rider-details-grid">
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
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="rider-wizard-stage-heading">
                  <h3>Address and proof of address</h3>
                  <p>You can save what you have now and come back to missing items later.</p>
                </div>
                <div className="rider-details-grid">
                  <label className="rider-details-wide">
                    Home address
                    <textarea
                      autoComplete="street-address"
                      maxLength={500}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, address: event.target.value }))
                      }
                      rows={3}
                      value={form.address}
                    />
                  </label>
                  <label className="rider-details-wide">
                    Proof of address (PDF, JPG or PNG; max 5 MB)
                    <input
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                      type="file"
                    />
                    {savedProof && (
                      <>
                        <a
                          className="rider-document-link"
                          href={`/api/admin/riders/${activeRiderId}/documents/proof-of-address`}
                        >
                          Download saved document: {savedProof.fileName}
                        </a>
                        <span className={`rider-document-status rider-document-status-${savedProof.approvalStatus}`}>
                          {savedProof.approvalStatus === "approved"
                            ? "Approved"
                            : savedProof.approvalStatus === "declined"
                              ? "Declined — upload a replacement if needed"
                              : "Awaiting approval"}
                        </span>
                        {savedProof.reviewNote && (
                          <small className="rider-document-review-note">
                            Review note: {savedProof.reviewNote}
                          </small>
                        )}
                      </>
                    )}
                  </label>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="rider-wizard-stage-heading">
                  <h3>Identity details</h3>
                  <p>BVN is optional. Include the NIN slip whenever you submit an NIN.</p>
                </div>
                <div className="rider-details-grid">
                  <label>
                    BVN
                    <input
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={11}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          bvn: event.target.value.replace(/\D/g, "").slice(0, 11),
                        }))
                      }
                      placeholder={
                        savedIdentity.hasBvn
                          ? `Saved ending ${savedIdentity.bvnLastFour}; blank keeps it`
                          : "11 digits"
                      }
                      type="password"
                      value={form.bvn}
                    />
                  </label>
                  <label>
                    NIN
                    <input
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={11}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nin: event.target.value.replace(/\D/g, "").slice(0, 11),
                        }))
                      }
                      placeholder={
                        savedIdentity.hasNin
                          ? `Saved ending ${savedIdentity.ninLastFour}; blank keeps it`
                          : "11 digits"
                      }
                      type="password"
                      value={form.nin}
                    />
                    <span className="rider-form-hint">
                      Upload the NIN slip whenever you submit an NIN number.
                    </span>
                  </label>
                  <label className="rider-details-wide">
                    NIN slip (PDF, JPG or PNG; max 5 MB)
                    <input
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) =>
                        setNinSlipFile(event.target.files?.[0] || null)
                      }
                      required={Boolean(form.nin && !savedNinSlip)}
                      type="file"
                    />
                    {savedNinSlip && (
                      <>
                        <a
                          className="rider-document-link"
                          href={`/api/admin/riders/${activeRiderId}/documents/nin-slip`}
                        >
                          Download saved NIN slip: {savedNinSlip.fileName}
                        </a>
                        <span className={`rider-document-status rider-document-status-${savedNinSlip.approvalStatus}`}>
                          {savedNinSlip.approvalStatus === "approved"
                            ? "Approved"
                            : savedNinSlip.approvalStatus === "declined"
                              ? "Declined — upload a replacement if needed"
                              : "Awaiting approval"}
                        </span>
                        {savedNinSlip.reviewNote && (
                          <small className="rider-document-review-note">
                            Review note: {savedNinSlip.reviewNote}
                          </small>
                        )}
                      </>
                    )}
                  </label>
                </div>
                <p className="rider-privacy-note">
                  Saved BVN and NIN values are masked. Leave a field blank to keep an existing number unchanged.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rider-wizard-stage-heading">
                  <h3>Onboarding saved</h3>
                  <p>
                    This rider will remain in the rider list at {progress}% complete. You can continue onboarding later.
                  </p>
                </div>
                <div className="rider-wizard-summary">
                  <strong>{form.name}</strong>
                  <span>{form.email}</span>
                  <span>{form.phone}</span>
                  <div className="rider-progress">
                    <div className="rider-progress-label">
                      <span>Profile completion</span>
                      <strong>{progress}%</strong>
                    </div>
                    <div
                      aria-label={`Onboarding ${progress}% complete`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={progress}
                      className="rider-progress-track"
                      role="progressbar"
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {error && <p className="rider-form-message rider-form-error" role="alert">{error}</p>}

          <footer className="rider-wizard-actions">
            {step > 0 ? (
              <button
                className="rider-wizard-secondary"
                disabled={saving}
                onClick={() => saveStep(-1)}
                type="button"
              >
                Back
              </button>
            ) : <span />}
            <button className="admin-action-button" disabled={saving} type="submit">
              {saving
                ? "Saving…"
                : step === 3
                  ? "Finish"
                  : "Save and continue"}
            </button>
          </footer>
        </form>
      )}
    </section>
  );
}
