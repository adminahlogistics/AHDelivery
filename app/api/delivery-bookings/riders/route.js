import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import { getRiderOnboardingProgress } from "@/lib/riderOnboarding";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const riders = await Rider.find({})
      .select(
        "_id name email phone status addressProvided proofOfAddressProvided bvnProvided ninProvided ninSlipProvided"
      )
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      riders: riders.map((rider) => ({
        id: String(rider._id),
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        status: rider.status,
        onboardingProgress: getRiderOnboardingProgress(rider),
      })),
    });
  } catch (error) {
    console.error("Could not load rider profiles:", error);
    return NextResponse.json(
      { success: false, message: "Rider profiles are temporarily unavailable." },
      { status: 500 }
    );
  }
}
