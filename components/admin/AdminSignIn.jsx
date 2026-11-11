import Link from "next/link";
import { isDevelopmentDemoMode } from "@/lib/accessControl";

export default function AdminSignIn() {
  const demoMode = isDevelopmentDemoMode();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
          AH Parcel Delivery
        </p>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">
          {demoMode ? "Local back-office demo" : "Back-office access is disabled"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {demoMode
            ? "This development demo has no sign-in or access control. Do not expose it to the public internet."
            : "A production authentication provider must be configured before back-office access can be enabled."}
        </p>
        {demoMode && (
          <Link
            className="mt-6 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white"
            href="/admin"
          >
            Open demo dashboard
          </Link>
        )}
        <Link className="mt-6 block text-sm text-gray-600 underline" href="/">
          Return to AH Delivery
        </Link>
      </section>
    </main>
  );
}
