import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import { RIDER_DOCUMENT_FIELDS } from "@/lib/riderDocuments";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const isValidRiderId = (id) => /^[\da-f]{24}$/i.test(id);

export async function GET() {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  try {
    await connectDB();
    const riders = await Rider.find({
      $or: [
        { "proofOfAddress.ciphertext": { $exists: true } },
        { "ninSlip.ciphertext": { $exists: true } },
      ],
    })
      .select(
        "_id name email proofOfAddress.fileName proofOfAddress.approvalStatus proofOfAddress.submittedAt proofOfAddress.reviewedAt proofOfAddress.reviewNote ninSlip.fileName ninSlip.approvalStatus ninSlip.submittedAt ninSlip.reviewedAt ninSlip.reviewNote"
      )
      .lean();

    const documents = [];
    for (const rider of riders) {
      for (const [documentType, config] of Object.entries(RIDER_DOCUMENT_FIELDS)) {
        const document = rider[config.field];
        if (!document?.fileName) continue;

        documents.push({
          riderId: String(rider._id),
          riderName: rider.name,
          riderEmail: rider.email,
          documentType,
          label: config.label,
          fileName: document.fileName,
          status: document.approvalStatus || "pending",
          submittedAt: document.submittedAt || null,
          reviewedAt: document.reviewedAt || null,
          reviewNote: document.reviewNote || "",
        });
      }
    }

    documents.sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightTime - leftTime;
    });

    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("Could not load rider document approvals:", error);
    return NextResponse.json(
      { success: false, message: "Rider document approvals are temporarily unavailable." },
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
      { success: false, message: "The approval decision could not be read." },
      { status: 400 }
    );
  }

  const riderId =
    typeof payload?.riderId === "string" ? payload.riderId.trim() : "";
  const documentType = payload?.documentType;
  const decision = payload?.decision;
  const note = payload?.note;
  const documentConfig =
    typeof documentType === "string" &&
    Object.hasOwn(RIDER_DOCUMENT_FIELDS, documentType)
      ? RIDER_DOCUMENT_FIELDS[documentType]
      : null;

  if (
    !isValidRiderId(riderId) ||
    !documentConfig ||
    !["approved", "declined"].includes(decision) ||
    (note !== undefined && (typeof note !== "string" || note.trim().length > 500))
  ) {
    return NextResponse.json(
      { success: false, message: "A valid document and approval decision are required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const field = documentConfig.field;
    const updatedRider = await Rider.findOneAndUpdate(
      { _id: riderId, [`${field}.ciphertext`]: { $exists: true } },
      {
        $set: {
          [`${field}.approvalStatus`]: decision,
          [`${field}.reviewedAt`]: new Date(),
          [`${field}.reviewNote`]: typeof note === "string" ? note.trim() : "",
        },
      },
      { new: true, runValidators: true }
    ).select(`_id ${field}.fileName ${field}.approvalStatus ${field}.reviewedAt ${field}.reviewNote`);

    if (!updatedRider) {
      return NextResponse.json(
        { success: false, message: "The rider document was not found." },
        { status: 404 }
      );
    }

    const document = updatedRider[field];
    return NextResponse.json({
      success: true,
      document: {
        riderId: String(updatedRider._id),
        documentType,
        fileName: document.fileName,
        status: document.approvalStatus,
        reviewedAt: document.reviewedAt,
        reviewNote: document.reviewNote || "",
      },
    });
  } catch (error) {
    console.error("Could not save rider document approval:", error);
    return NextResponse.json(
      { success: false, message: "The approval decision could not be saved." },
      { status: 500 }
    );
  }
}
