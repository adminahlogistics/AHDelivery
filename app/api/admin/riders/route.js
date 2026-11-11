import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const readText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export async function POST(request) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The rider details could not be read." },
      { status: 400 }
    );
  }

  const name = readText(payload?.name, 100);
  const email = readText(payload?.email, 254).toLowerCase();
  const phone = readText(payload?.phone, 30);
  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\+?[0-9\s()-]{7,30}$/.test(phone)
  ) {
    return NextResponse.json(
      { success: false, message: "Enter a valid name, email address, and phone number." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const rider = await Rider.create({ name, email, phone, status: "active" });
    return NextResponse.json(
      {
        success: true,
        rider: {
          id: String(rider._id),
          name: rider.name,
          email: rider.email,
          phone: rider.phone,
          status: rider.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A rider profile already exists for this email address." },
        { status: 409 }
      );
    }
    console.error("Could not create rider profile:", error);
    return NextResponse.json(
      { success: false, message: "The rider profile could not be created." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The rider status update could not be read." },
      { status: 400 }
    );
  }

  const riderId = readText(payload?.riderId, 80);
  const status = payload?.status;
  if (!riderId || !["active", "inactive"].includes(status)) {
    return NextResponse.json(
      { success: false, message: "A valid rider and status are required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const rider = await Rider.findByIdAndUpdate(
      riderId,
      { $set: { status } },
      { new: true, runValidators: true }
    ).select("_id name email phone status");
    if (!rider) {
      return NextResponse.json(
        { success: false, message: "The rider profile was not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      rider: {
        id: String(rider._id),
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        status: rider.status,
      },
    });
  } catch (error) {
    console.error("Could not update rider profile:", error);
    return NextResponse.json(
      { success: false, message: "The rider status could not be updated." },
      { status: 500 }
    );
  }
}
