export function normalizeCustomerPhone(phone) {
  return typeof phone === "string" ? phone.replace(/\D/g, "") : "";
}
