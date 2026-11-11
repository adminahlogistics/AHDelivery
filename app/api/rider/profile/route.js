import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireRole("rider");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const riders = await Rider.find({ status: "active" })
      .select("_id name")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({
      success: true,
      demoMode: true,
      riders: riders.map(({ _id, name }) => ({ id: String(_id), name })),
    });
  } catch (error) {
    console.error("Could not load demo rider profiles:", error);
    return NextResponse.json(
      { success: false, message: "Rider profiles are temporarily unavailable." },
      { status: 500 }
    );
  }
}
