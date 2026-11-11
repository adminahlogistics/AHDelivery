import Link from "next/link";
import { FaArrowRight, FaShippingFast } from "react-icons/fa";

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="AH Delivery home">
      <span className="brand-mark">
        <FaShippingFast aria-hidden="true" />
      </span>
      <span>
        <strong>AH</strong> Delivery
      </span>
    </Link>
  );
}

const links = [
  { label: "Services", href: "/#services" },
  { label: "About", href: "/about" },
  { label: "FAQs", href: "/#faq" },
];

export default function LandingHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          {links.map(({ label, href }) => (
            <Link href={href} key={label}>
              {label}
            </Link>
          ))}
          <Link className="admin-dashboard-link" href="/admin">
            Back office
          </Link>
        </nav>
        <Link className="button button-small header-cta" href="/#booking">
          Book a delivery <FaArrowRight aria-hidden="true" />
        </Link>
        <details className="mobile-nav">
          <summary aria-label="Open navigation menu">
            <span />
            <span />
            <span />
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            {links.map(({ label, href }) => (
              <Link href={href} key={label}>
                {label}
              </Link>
            ))}
            <Link href="/admin">Back office</Link>
            <Link href="/#booking">Book a delivery</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
