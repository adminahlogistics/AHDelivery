"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All documents" },
];

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString();
}

export default function RiderDocumentApprovalsPage() {
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/rider-approvals", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load rider documents.");
      }
      setDocuments(result.documents);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load rider documents."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(
    () =>
      filter === "all"
        ? documents
        : documents.filter((document) => document.status === filter),
    [documents, filter]
  );

  const reviewDocument = async (document, decision) => {
    const itemId = `${document.riderId}:${document.documentType}`;
    setSavingId(itemId);
    setError("");
    try {
      const response = await fetch("/api/admin/rider-approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riderId: document.riderId,
          documentType: document.documentType,
          decision,
          note: notes[itemId] || "",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not save the review decision.");
      }

      setDocuments((current) =>
        current.map((item) =>
          item.riderId === document.riderId &&
          item.documentType === document.documentType
            ? {
                ...item,
                status: result.document.status,
                reviewedAt: result.document.reviewedAt,
                reviewNote: result.document.reviewNote,
              }
            : item
        )
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Could not save the review decision."
      );
    } finally {
      setSavingId("");
    }
  };

  return (
    <main className="admin-content">
      <header className="admin-topbar">
        <div className="admin-topbar-spacer" />
        <span className="admin-live-indicator">
          <span />
          Rider document review
        </span>
      </header>

      <section className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">REQUESTS</p>
          <h1>Document approvals</h1>
          <p className="admin-heading-description">
            Review rider proof-of-address documents and NIN slips.
          </p>
        </div>
      </section>

      <section className="admin-orders-section" aria-labelledby="approval-list-title">
        <div className="admin-orders-heading rider-approvals-heading">
          <div>
            <h2 id="approval-list-title">Submitted documents</h2>
            <p>
              {loading
                ? "Loading documents…"
                : `${documents.filter((document) => document.status === "pending").length} awaiting review`}
            </p>
          </div>
          <div className="rider-approval-filters" aria-label="Filter documents">
            {FILTERS.map((item) => (
              <button
                aria-pressed={filter === item.value}
                className={`rider-approval-filter${filter === item.value ? " rider-approval-filter-active" : ""}`}
                key={item.value}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="admin-booking-error" role="alert">{error}</p>}
        {loading ? (
          <p className="admin-booking-empty">Loading rider documents…</p>
        ) : filteredDocuments.length ? (
          <div className="rider-approval-list">
            {filteredDocuments.map((document) => {
              const itemId = `${document.riderId}:${document.documentType}`;
              return (
                <article className="rider-approval-card" key={itemId}>
                  <div className="rider-approval-card-heading">
                    <div className="rider-approval-rider">
                      <strong>{document.riderName}</strong>
                      <span>{document.riderEmail}</span>
                    </div>
                    <span className={`rider-document-status rider-document-status-${document.status}`}>
                      {document.status}
                    </span>
                  </div>
                  <div className="rider-approval-document">
                    <div>
                      <strong>{document.label}</strong>
                      <span>{document.fileName}</span>
                    </div>
                    <a
                      className="rider-document-link"
                      href={`/api/admin/riders/${document.riderId}/documents/${document.documentType}`}
                    >
                      Download document
                    </a>
                  </div>
                  <p className="rider-approval-date">
                    Submitted: {formatDate(document.submittedAt)}
                    {document.reviewedAt &&
                      ` · Reviewed: ${formatDate(document.reviewedAt)}`}
                  </p>
                  {document.reviewNote && (
                    <p className="rider-document-review-note">
                      Review note: {document.reviewNote}
                    </p>
                  )}
                  {document.status === "pending" && (
                    <div className="rider-approval-actions">
                      <label>
                        Review note (optional)
                        <textarea
                          maxLength={500}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [itemId]: event.target.value,
                            }))
                          }
                          rows={2}
                          value={notes[itemId] || ""}
                        />
                      </label>
                      <div>
                        <button
                          className="rider-approval-decline"
                          disabled={savingId === itemId}
                          onClick={() => reviewDocument(document, "declined")}
                          type="button"
                        >
                          {savingId === itemId ? "Saving…" : "Decline"}
                        </button>
                        <button
                          className="admin-action-button"
                          disabled={savingId === itemId}
                          onClick={() => reviewDocument(document, "approved")}
                          type="button"
                        >
                          {savingId === itemId ? "Saving…" : "Approve"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="admin-booking-empty">
            {filter === "pending"
              ? "No documents are waiting for review."
              : "No documents match this filter."}
          </p>
        )}
      </section>
    </main>
  );
}
