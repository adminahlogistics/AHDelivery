"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FaSearch, FaUsers } from "react-icons/fa";

const formatCustomerDate = (date) => {
  const value = date ? new Date(date) : new Date();
  const weekday = value.toLocaleDateString("en-US", { weekday: "short" });
  const day = value.getDate();
  const month = value.toLocaleDateString("en-US", { month: "long" });
  const year = value.getFullYear();

  return `${weekday} ${day} ${month}, ${year}`;
};

const getCustomerOnboardingProgress = (customer) => {
  if (!customer?.deliveryCount) return 0;
  return Math.min(100, Math.round((customer.completedDeliveries / customer.deliveryCount) * 100));
};

const getCustomerProfileStatus = (customer) =>
  customer?.blocked ? "Blocked" : "Active";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenuPhone, setOpenMenuPhone] = useState("");
  const [blockError, setBlockError] = useState("");
  const [updatingPhone, setUpdatingPhone] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/customers", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Could not load customers.");
        }
        if (active) setCustomers(result.customers);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load customers."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleCustomers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.lastOrderReference]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [customers, query]);

  const updateBlockStatus = async (customer) => {
    const action = customer.blocked ? "unblock" : "block";
    if (
      action === "block" &&
      !window.confirm(
        `Block ${customer.name || "this customer"}? New bookings from ${customer.phone} will be rejected.`
      )
    ) {
      return;
    }

    setBlockError("");
    setUpdatingPhone(customer.phone);
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

      setCustomers((current) =>
        current.map((item) =>
          item.phone === customer.phone
            ? { ...item, blocked: result.blocked }
            : item
        )
      );
      setOpenMenuPhone("");
    } catch (updateError) {
      setBlockError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update customer status."
      );
    } finally {
      setUpdatingPhone("");
    }
  };

  return (
    <main className="admin-content">
      <header className="admin-topbar">
        <div className="admin-topbar-spacer" />
        <span className="admin-live-indicator">
          <span />
          Customer records
        </span>
      </header>

      <section className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">CUSTOMER CARE</p>
          <h1>Customers</h1>
          <p className="admin-heading-description">
            See repeat senders, recent orders, and outstanding pay-on-delivery
            amounts.
          </p>
        </div>
        <label className="admin-search">
          <FaSearch aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone, or order"
            aria-label="Search customers"
          />
        </label>
      </section>

      <section className="admin-orders-section">
        {blockError && <p className="admin-booking-error" role="alert">{blockError}</p>}
        {error ? (
          <p className="admin-booking-error" role="alert">{error}</p>
        ) : visibleCustomers.length ? (
          <>
            <div className="customer-arrangement">
              <div className="customer-arrangement-header" aria-hidden="true">
                <span className="customer-col customer-col-name">Customer name</span>
                <span className="customer-col customer-col-status">Onboarding status</span>
                <span className="customer-col customer-col-profile">Profile status</span>
                <span className="customer-col customer-col-date">Reg date</span>
                <span className="customer-col customer-col-menu" aria-hidden="true" />
              </div>

              {visibleCustomers.map((customer) => {
                const onboardingProgress = getCustomerOnboardingProgress(customer);
                const profileStatus = getCustomerProfileStatus(customer);

                return (
                  <div className="customer-arrangement-row" key={customer.phone}>
                    <Link
                      className="customer-row-link"
                      href={`/admin/customers/${encodeURIComponent(customer.phone)}`}
                    >
                      <div className="customer-col customer-col-name">
                        <div className="customer-name-wrap">
                          <span className="customer-avatar" aria-hidden="true">
                            {(customer.name || "C").charAt(0).toUpperCase()}
                          </span>
                          <div className="customer-name-meta">
                            <strong>{customer.name || "Unnamed customer"}</strong>
                            <span>{customer.phone || "No phone"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="customer-col customer-col-status">
                        <span className="customer-progress-value">{onboardingProgress}%</span>
                      </div>

                      <div className="customer-col customer-col-profile">
                        <span className={`customer-pill ${customer.blocked ? "customer-pill-inactive" : "customer-pill-active"}`}>
                          {profileStatus}
                        </span>
                      </div>

                      <div className="customer-col customer-col-date">
                        {formatCustomerDate(customer.createdAt)}
                      </div>
                    </Link>

                    <div className="customer-menu-wrap">
                      <button
                        aria-expanded={openMenuPhone === customer.phone}
                        aria-label={`Actions for ${customer.name || "customer"}`}
                        className="customer-menu-button"
                        disabled={updatingPhone === customer.phone}
                        onClick={() =>
                          setOpenMenuPhone((current) =>
                            current === customer.phone ? "" : customer.phone
                          )
                        }
                        type="button"
                      >
                        •••
                      </button>
                      {openMenuPhone === customer.phone && (
                        <div className="customer-action-menu">
                          <Link
                            href={`/admin/customers/${encodeURIComponent(customer.phone)}`}
                            onClick={() => setOpenMenuPhone("")}
                          >
                            View profile
                          </Link>
                          <button
                            disabled={updatingPhone === customer.phone}
                            onClick={() => updateBlockStatus(customer)}
                            type="button"
                          >
                            {customer.blocked ? "Unblock customer" : "Block customer"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          !loading && (
            <div className="admin-empty-state">
              <span className="admin-empty-icon"><FaUsers aria-hidden="true" /></span>
              <h3>{query ? "No matching customers" : "No customers yet"}</h3>
              <p>
                Customers will appear here after they place a delivery order.
              </p>
            </div>
          )
        )}
      </section>
    </main>
  );
}
