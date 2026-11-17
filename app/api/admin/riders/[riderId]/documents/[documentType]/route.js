import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import {
  decryptRiderData,
  RiderEncryptionConfigurationError,
} from "@/lib/riderDataEncryption";
import { RIDER_DOCUMENT_FIELDS } from "@/lib/riderDocuments";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request, context) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  const { riderId, documentType } = await context.params;
  const documentConfig =
    Object.hasOwn(RIDER_DOCUMENT_FIELDS, documentType)
      ? RIDER_DOCUMENT_FIELDS[documentType]
      : null;
  if (!/^[\da-f]{24}$/i.test(riderId) || !documentConfig) {
    return NextResponse.json(
      { success: false, message: "A valid rider document is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const rider = await Rider.findById(riderId).select(documentConfig.field);
    const document = rider?.[documentConfig.field];
    if (!document?.ciphertext) {
      return NextResponse.json(
        { success: false, message: "The rider document was not found." },
        { status: 404 }
      );
    }

    const file = decryptRiderData(document);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.fileName}"`,
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
    console.error("Could not retrieve rider document.");
    return NextResponse.json(
      { success: false, message: "The rider document is temporarily unavailable." },
      { status: 500 }
    );
  }
}
