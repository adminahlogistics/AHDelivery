"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const currency = process.env.NEXT_PUBLIC_CURRENCY || "₦";
const tabs = ["Profile", "KYC", "Wallet", "Order History"];

const formatDate = (date) =>
  date
    ? new Intl.DateTimeFormat("en", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(date))
    : "—";

const formatStatus = (status) =>
  (status || "unknown").replaceAll("_", " ");

export default function CustomerDetailsPage() {
  const { phone } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("Profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(phone)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load customer details.");
      }
      setCustomer(result.customer);
      setOrders(result.orders);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load customer details."
      );
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    if (phone) loadCustomer();
  }, [loadCustomer, phone]);

  const toggleBlock = async () => {
    if (!customer) return;
    const action = customer.blocked ? "unblock" : "block";
    if (
      action === "block" &&
      !window.confirm(
        `Block ${customer.name || "this customer"}? New bookings from ${customer.phone} will be rejected.`
      )
    ) {
      return;
    }

    setSavingStatus(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(customer.phone)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not update customer status.");
      }
      setCustomer((current) => ({ ...current, blocked: result.blocked }));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update customer status."
      );
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <main className="admin-content customer-detail-page">
      <Link className="customer-back-link" href="/admin/customers">
        <span aria-hidden="true">←</span>
        Back to Customers
      </Link>

      {error && <p className="admin-booking-error" role="alert">{error}</p>}
      {loading ? (
        <p className="admin-booking-empty">Loading customer details…</p>
      ) : customer ? (
        <section className="customer-detail-panel">
          <div className="customer-detail-header">
            <h1>{customer.name || "Unnamed customer"}</h1>
            <span className={`customer-detail-status ${customer.blocked ? "customer-detail-status-blocked" : ""}`}>
              {customer.blocked ? "Blocked" : "Active"}
            </span>
          </div>
          <div className="customer-detail-email">Email not provided</div>

          <div className="customer-detail-tabs">
            <div className="customer-detail-tab-list" role="tablist" aria-label="Customer profile sections">
              {tabs.map((tab) => (
                <button
                  aria-selected={activeTab === tab}
                  className={`customer-detail-tab ${activeTab === tab ? "customer-detail-tab-active" : ""}`}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              className={`customer-action-button ${customer.blocked ? "customer-action-secondary" : "customer-action-primary"}`}
              disabled={savingStatus}
              onClick={toggleBlock}
              type="button"
            >
              {savingStatus
                ? "Saving…"
                : customer.blocked
                  ? "Unblock"
                  : "Block"}
            </button>
          </div>

          {activeTab === "Profile" ? (
            <div className="customer-detail-section" role="tabpanel">
              <h2>Personal Details</h2>
              <div className="customer-profile-fields">
                <div className="customer-detail-field">
                  <span>Customer Name</span>
                  <strong>{customer.name || "—"}</strong>
                </div>
                <div className="customer-detail-field">
                  <span>Phone Number</span>
                  <strong>{customer.phone || "—"}</strong>
                </div>
                <div className="customer-detail-field">
                  <span>Email Address</span>
                  <strong>Not provided</strong>
                </div>
                <div className="customer-detail-field">
                  <span>Registration Date</span>
                  <strong>{formatDate(customer.createdAt)}</strong>
                </div>
                <div className="customer-detail-field">
                  <span>Deliveries</span>
                  <strong>{customer.deliveryCount}</strong>
                </div>
                <div className="customer-detail-field">
                  <span>Completed Deliveries</span>
                  <strong>{customer.completedDeliveries}</strong>
                </div>
              </div>
            </div>
          ) : activeTab === "Order History" ? (
            <div className="customer-detail-section" role="tabpanel">
              <div className="customer-history-heading">
                <div>
                  <h2>Order History</h2>
                  <p>{orders.length} {orders.length === 1 ? "delivery" : "deliveries"}</p>
                </div>
              </div>
              {orders.length ? (
                <div className="customer-history-list">
                  {orders.map((order) => (
                    <article className="customer-history-row" key={order.reference}>
                      <div className="customer-history-main">
                        <strong>{order.reference}</strong>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="customer-history-destination">
                        <span>Delivering to</span>
                        <strong>{order.delivery?.address || "—"}</strong>
                      </div>
                      <span className="customer-history-status">
                        {formatStatus(order.status)}
                      </span>
                      <div className="customer-history-total">
                        <span>{order.payment?.status?.replaceAll("_", " ") || "Payment status unavailable"}</span>
                        <strong>
                          {currency}
                          {(order.quote?.amount || 0).toLocaleString()}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-booking-empty">No delivery history is available.</p>
              )}
            </div>
          ) : (
            <div className="customer-detail-section" role="tabpanel">
              <h2>{activeTab === "KYC" ? "KYC Details" : "Wallet"}</h2>
              <p className="customer-detail-empty">
                {activeTab === "KYC"
                  ? "KYC information is not collected for customer records."
                  : "Wallet information is not available for customer records."}
              </p>
            </div>
          )}
        </section>
      ) : (
        !error && <p className="admin-booking-empty">Customer record not found.</p>
      )}
    </main>
  );
}
