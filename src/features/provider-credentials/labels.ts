const typeKeys = {
  EDUCATION: "credential.type.education", SPECIALIZATION: "credential.type.specialization", LICENSE: "credential.type.license",
  CERTIFICATION: "credential.type.certification", OTHER: "credential.type.other",
} as const;
const stateKeys = {
  DRAFT: "credential.state.draft", SUBMITTED: "credential.state.submitted", APPROVED: "credential.state.approved",
  REJECTED: "credential.state.rejected",
} as const;

// Present API-provided values only; unknown values are shown as unavailable, never as a review outcome.
export const credentialTypeKey = (type: string) =>
  Object.hasOwn(typeKeys, type) ? typeKeys[type as keyof typeof typeKeys] : "credential.type.unknown";
export const credentialStateKey = (state: string) =>
  Object.hasOwn(stateKeys, state) ? stateKeys[state as keyof typeof stateKeys] : "credential.state.unknown";
