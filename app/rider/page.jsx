import Link from "next/link";
import { RIDER_PORTAL_ENABLED } from "@/lib/riderPortal";
import RiderDashboardContent from "./RiderDashboard";

export default function RiderPortalPage() {
  if (RIDER_PORTAL_ENABLED) return <RiderDashboardContent />;

  return (
    <main className="rider-dashboard">
      <header className="rider-header">
        <div>
          <p className="admin-eyebrow">AH DELIVERY</p>
          <h1>Rider portal temporarily unavailable</h1>
          <p>Rider access is paused for now. Please check back later.</p>
        </div>
        <Link href="/">Back to website</Link>
      </header>
    </main>
  );
}
