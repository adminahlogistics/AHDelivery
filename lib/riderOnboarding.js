const PROFILE_COMPLETION_FIELDS = [
  "addressProvided",
  "proofOfAddressProvided",
  "bvnProvided",
  "ninProvided",
  "ninSlipProvided",
];

export function getRiderOnboardingProgress(rider) {
  if (!rider?.name || !rider?.email) return 0;

  const completedFields = PROFILE_COMPLETION_FIELDS.filter(
    (field) => rider[field]
  ).length;

  return 5 + Math.round((completedFields / PROFILE_COMPLETION_FIELDS.length) * 95);
}
