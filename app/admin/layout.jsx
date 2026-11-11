
import AdminSidebar from "@/components/admin/AdminSidebar";
import Link from "next/link";
import { isDevelopmentDemoMode } from "@/lib/accessControl";
import "./admin.css";

export default function AdminLayout({ children }) {
  if (!isDevelopmentDemoMode()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <section className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Back office is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            The back office is running without authentication and is therefore
            available only in local development. Configure a production
            authentication provider before deploying it.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white"
            href="/"
          >
            Return to AH Delivery
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        
        {children}
      </div>
    </div>
  );
}
