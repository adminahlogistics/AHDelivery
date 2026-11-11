import Link from "next/link";
import { FaShippingFast, FaWhatsapp } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3 md:px-10">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xl font-bold text-gray-900"
          >
            <FaShippingFast className="text-orange-600" aria-hidden="true" />
            AH Delivery
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-gray-600">
            Local parcel delivery with convenient pickup and helpful support.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Explore</h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/about">About AH Delivery</Link></li>
            <li><Link href="/#booking">Book a delivery</Link></li>
            <li><Link href="/admin">Back office</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Contact</h2>
          <a
            className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            href="https://wa.me/2348074602167"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            Chat with us on WhatsApp
          </a>
        </div>
      </div>
      <p className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} AH Parcel Delivery
      </p>
    </footer>
  );
}
