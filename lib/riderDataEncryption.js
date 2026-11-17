import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_KEY_ENV = "RIDER_PII_ENCRYPTION_KEY";

export class RiderEncryptionConfigurationError extends Error {
  constructor() {
    super(`${ENCRYPTION_KEY_ENV} must be a base64-encoded 32-byte key.`);
    this.name = "RiderEncryptionConfigurationError";
  }
}

function getEncryptionKey() {
  const encodedKey = process.env[ENCRYPTION_KEY_ENV];
  if (!encodedKey) throw new RiderEncryptionConfigurationError();

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new RiderEncryptionConfigurationError();
  return key;
}

export function encryptRiderData(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext,
  };
}

export function decryptRiderData(encryptedValue) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encryptedValue.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encryptedValue.authTag, "base64"));
  return Buffer.concat([
    decipher.update(encryptedValue.ciphertext),
    decipher.final(),
  ]);
}
