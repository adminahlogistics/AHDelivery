"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaChartBar,
  FaClipboardList,
  FaCog,
  FaCreditCard,
  FaFileAlt,
  FaShippingFast,
  FaThLarge,
} from "react-icons/fa";

const navigation = [
  { label: "Overview", href: "/admin", icon: FaThLarge },
  { label: "Orders", href: "/admin", icon: FaClipboardList, active: true },
  { label: "Riders", href: "/admin/riders", icon: FaShippingFast },
  { label: "Documents", icon: FaFileAlt, unavailable: true },
  { label: "Finance", icon: FaCreditCard, unavailable: true },
  { label: "Analytics", icon: FaChartBar, unavailable: true },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/">
        <span className="admin-brand-mark">
          <FaShippingFast aria-hidden="true" />
        </span>
        <span>AH <strong>Backoffice</strong></span>
      </Link>

      <nav className="admin-navigation" aria-label="Backoffice navigation">
        {navigation.map(({ label, href, icon: Icon, active, unavailable }) => {
          const isActive = active && pathname === href ||
            label === "Riders" && pathname.startsWith("/admin/riders");
          const item = (
            <>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {unavailable && <small>Soon</small>}
            </>
          );

          return unavailable ? (
            <div className="admin-nav-item admin-nav-unavailable" key={label} aria-disabled="true">
              {item}
            </div>
          ) : (
            <Link
              className={`admin-nav-item${isActive ? " admin-nav-active" : ""}`}
              href={href}
              key={label}
            >
              {item}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-bottom">
        <div className="admin-sidebar-divider" />
        <div className="admin-sidebar-utility">
          <FaCog aria-hidden="true" />
          <span>Account settings</span>
        </div>
        <div className="admin-profile">
          <span className="admin-customer-avatar" aria-hidden="true">D</span>
          <span>Local demo</span>
        </div>
      </div>
    </aside>
  );
}
