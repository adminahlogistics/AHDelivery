import Link from "next/link";
import { FaBoxOpen, FaMapMarkerAlt, FaShippingFast } from "react-icons/fa";
import Footer from "@/components/Footer";
import LandingHeader from "@/components/LandingHeader";

const values = [
  {
    icon: FaShippingFast,
    title: "Dependable delivery",
    description:
      "We help people and businesses move parcels from pickup to drop-off with care.",
  },
  {
    icon: FaMapMarkerAlt,
    title: "Convenient pickup",
    description:
      "Arrange a collection from a home, office, or another suitable address.",
  },
  {
    icon: FaBoxOpen,
    title: "Thoughtful handling",
    description:
      "Clear parcel details and contact information help our team handle each request.",
  },
];

export default function AboutPage() {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto min-h-[65vh] max-w-6xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          About AH Delivery
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          Making everyday parcel delivery feel simple.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          AH Parcel Delivery helps individuals and businesses arrange parcel
          pickups and deliveries, with a focus on clear details and helpful
          service.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {values.map(({ icon: Icon, title, description }) => (
            <article className="rounded-2xl border border-gray-200 p-6" key={title}>
              <Icon className="text-2xl text-orange-600" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-2 leading-7 text-gray-600">{description}</p>
            </article>
          ))}
        </div>
        <Link
          className="mt-10 inline-flex items-center rounded-full bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-700"
          href="/#booking"
        >
          Arrange a delivery
        </Link>
      </main>
      <Footer />
    </>
  );
}
