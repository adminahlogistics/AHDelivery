import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import {
  decryptRiderData,
  RiderEncryptionConfigurationError,
} from "@/lib/riderDataEncryption";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request, context) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  const { riderId } = await context.params;
  if (!/^[\da-f]{24}$/i.test(riderId)) {
    return NextResponse.json(
      { success: false, message: "A valid rider profile is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const rider = await Rider.findById(riderId).select("proofOfAddress");
    if (!rider?.proofOfAddress) {
      return NextResponse.json(
        { success: false, message: "Proof of address was not found." },
        { status: 404 }
      );
    }

    const { proofOfAddress } = rider;
    const document = decryptRiderData(proofOfAddress);
    return new NextResponse(document, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(proofOfAddress.fileName)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RiderEncryptionConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rider data encryption is not configured. Set RIDER_PII_ENCRYPTION_KEY before downloading documents.",
        },
        { status: 503 }
      );
    }
    console.error("Could not retrieve rider proof of address.");
    return NextResponse.json(
      { success: false, message: "Proof of address is temporarily unavailable." },
      { status: 500 }
    );
  }
}
