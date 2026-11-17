export const DELIVERY_HUBS = [
  { value: "yaba", label: "Yaba" },
  { value: "oshodi", label: "Oshodi" },
  { value: "island", label: "Island" },
];

export function getDeliveryHubLabel(value) {
  return DELIVERY_HUBS.find((hub) => hub.value === value)?.label || "";
}
