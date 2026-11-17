import { encryptRiderData } from "@/lib/riderDataEncryption";

export const RIDER_DOCUMENT_FIELDS = {
  "proof-of-address": {
    field: "proofOfAddress",
    label: "Proof of address",
    fileName: "proof-of-address",
  },
  "nin-slip": {
    field: "ninSlip",
    label: "NIN slip",
    fileName: "nin-slip",
  },
};

export function detectRiderDocumentType(buffer) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  return null;
}

export function encryptRiderDocument(buffer, documentType) {
  const fileType = detectRiderDocumentType(buffer);
  if (!fileType) return null;

  if (!Object.hasOwn(RIDER_DOCUMENT_FIELDS, documentType)) return null;
  const name = RIDER_DOCUMENT_FIELDS[documentType];

  return {
    ...encryptRiderData(buffer),
    fileName: `${name.fileName}.${fileType.extension}`,
    contentType: fileType.contentType,
    approvalStatus: "pending",
    submittedAt: new Date(),
    reviewedAt: undefined,
    reviewNote: "",
  };
}
