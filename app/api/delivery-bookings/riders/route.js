import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const riders = await Rider.find({})
      .select("_id name email phone status")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      riders: riders.map(({ _id, name, email, phone, status }) => ({
        id: String(_id),
        name,
        email,
        phone,
        status,
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
