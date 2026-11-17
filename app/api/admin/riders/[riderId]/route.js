import connectDB from "@/config/db";
import { requireRole } from "@/lib/accessControl";
import {
  decryptRiderData,
  encryptRiderData,
  RiderEncryptionConfigurationError,
} from "@/lib/riderDataEncryption";
import { encryptRiderDocument } from "@/lib/riderDocuments";
import { getRiderOnboardingProgress } from "@/lib/riderOnboarding";
import Rider from "@/models/Rider";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const isValidRiderId = (id) => /^[\da-f]{24}$/i.test(id);

function readFormText(formData, name, maxLength) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;

  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

const getDocumentSummary = (document) =>
  document
    ? {
        fileName: document.fileName,
        approvalStatus: document.approvalStatus || "pending",
        submittedAt: document.submittedAt || null,
        reviewedAt: document.reviewedAt || null,
        reviewNote: document.reviewNote || "",
      }
    : null;

function getProfileResponse(rider) {
  const bvn = rider.bvn
    ? decryptRiderData(rider.bvn).toString("utf8")
    : "";
  const nin = rider.nin
    ? decryptRiderData(rider.nin).toString("utf8")
    : "";

  return {
    success: true,
    profile: {
      id: String(rider._id),
      name: rider.name,
      email: rider.email,
      phone: rider.phone || "",
      address: rider.address
        ? decryptRiderData(rider.address).toString("utf8")
        : "",
      hasBvn: Boolean(rider.bvn),
      bvnLastFour: bvn.slice(-4),
      hasNin: Boolean(rider.nin),
      ninLastFour: nin.slice(-4),
      proofOfAddress: getDocumentSummary(rider.proofOfAddress),
      ninSlip: getDocumentSummary(rider.ninSlip),
      onboardingProgress: getRiderOnboardingProgress(rider),
    },
  };
}

export async function GET(_request, context) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  const { riderId } = await context.params;
  if (!isValidRiderId(riderId)) {
    return NextResponse.json(
      { success: false, message: "A valid rider profile is required." },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const rider = await Rider.findById(riderId).select(
      "_id name email phone address bvn nin proofOfAddress ninSlip addressProvided proofOfAddressProvided bvnProvided ninProvided ninSlipProvided"
    );
    if (!rider) {
      return NextResponse.json(
        { success: false, message: "The rider profile was not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(getProfileResponse(rider));
  } catch (error) {
    if (error instanceof RiderEncryptionConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rider data encryption is not configured. Set RIDER_PII_ENCRYPTION_KEY before opening rider profiles.",
        },
        { status: 503 }
      );
    }
    console.error("Could not load rider onboarding details.");
    return NextResponse.json(
      { success: false, message: "Rider onboarding details are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  const access = await requireRole("admin");
  if (!access.authorized) return access.response;

  const { riderId } = await context.params;
  if (!isValidRiderId(riderId)) {
    return NextResponse.json(
      { success: false, message: "A valid rider profile is required." },
      { status: 400 }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 11 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, message: "The rider details and files must be no larger than 11 MB." },
      { status: 413 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: "The rider details could not be read." },
      { status: 400 }
    );
  }

  const name = readFormText(formData, "name", 100);
  const email = readFormText(formData, "email", 254)?.toLowerCase();
  const phone = readFormText(formData, "phone", 30);
  const address = readFormText(formData, "address", 500);
  const bvn = readFormText(formData, "bvn", 11);
  const nin = readFormText(formData, "nin", 11);
  if (
    !name ||
    !email ||
    phone === null ||
    address === null ||
    bvn === null ||
    nin === null ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\+?[0-9\s()-]{7,30}$/.test(phone) ||
    (bvn && !/^\d{11}$/.test(bvn)) ||
    (nin && !/^\d{11}$/.test(nin))
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Enter a valid name, email, phone number, address, and 11-digit BVN/NIN values.",
      },
      { status: 400 }
    );
  }

  const uploadedDocuments = [
    { field: "proofOfAddress", label: "Proof of address" },
    { field: "ninSlip", label: "NIN slip" },
  ].map(({ field, label }) => ({ field, label, file: formData.get(field) }));
  for (const { label, file } of uploadedDocuments) {
    if (typeof file === "string" && file) {
      return NextResponse.json(
        { success: false, message: `Upload ${label.toLowerCase()} as a PDF, JPG, or PNG file.` },
        { status: 400 }
      );
    }
    if (file && typeof file !== "string" && file.name) {
      if (file.size === 0 || file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: `${label} must be a non-empty file no larger than 5 MB.` },
          { status: 400 }
        );
      }
    }
  }
  const ninSlipFile = uploadedDocuments.find(({ field }) => field === "ninSlip")?.file;
  if (nin && (!ninSlipFile || typeof ninSlipFile === "string" || !ninSlipFile.name)) {
    return NextResponse.json(
      { success: false, message: "Upload the NIN slip when submitting the NIN." },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const set = { name, email, phone };
    if (address) {
      set.address = encryptRiderData(Buffer.from(address, "utf8"));
      set.addressProvided = true;
    }
    if (bvn) {
      set.bvn = encryptRiderData(Buffer.from(bvn, "utf8"));
      set.bvnProvided = true;
    }
    if (nin) {
      set.nin = encryptRiderData(Buffer.from(nin, "utf8"));
      set.ninProvided = true;
    }

    for (const { field, file } of uploadedDocuments) {
      if (!file || typeof file === "string" || !file.name) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const document = encryptRiderDocument(
        buffer,
        field === "proofOfAddress" ? "proof-of-address" : "nin-slip"
      );
      if (!document) {
        return NextResponse.json(
          { success: false, message: "Upload a valid PDF, JPG, or PNG file." },
          { status: 400 }
        );
      }

      set[field] = document;
      set[field === "proofOfAddress" ? "proofOfAddressProvided" : "ninSlipProvided"] =
        true;
    }

    const rider = await Rider.findByIdAndUpdate(
      riderId,
      { $set: set },
      { new: true, runValidators: true }
    ).select(
      "_id name email phone addressProvided proofOfAddressProvided bvnProvided ninProvided ninSlipProvided status"
    );
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
        onboardingProgress: getRiderOnboardingProgress(rider),
      },
    });
  } catch (error) {
    if (error instanceof RiderEncryptionConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Rider data encryption is not configured. Set RIDER_PII_ENCRYPTION_KEY before saving sensitive details.",
        },
        { status: 503 }
      );
    }
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A rider profile already exists for this email address." },
        { status: 409 }
      );
    }
    console.error("Could not save rider onboarding details.");
    return NextResponse.json(
      { success: false, message: "Rider onboarding details could not be saved." },
      { status: 500 }
    );
  }
}
