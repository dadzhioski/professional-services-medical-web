import type { TranslationKey } from "@/lib/i18n/en";

export const doctorDecisions = ["approve", "reject", "suspend", "reinstate"] as const;
export type DoctorDecisionKind = (typeof doctorDecisions)[number];
export const credentialDecisions = ["approve", "reject"] as const;
export type CredentialDecisionKind = (typeof credentialDecisions)[number];

// Decision names arrive in the query string or from bound action arguments, so only allow-listed values are used.
export const isDoctorDecision = (value: unknown): value is DoctorDecisionKind =>
  typeof value === "string" && (doctorDecisions as readonly string[]).includes(value);
export const isCredentialDecision = (value: unknown): value is CredentialDecisionKind =>
  typeof value === "string" && (credentialDecisions as readonly string[]).includes(value);

export const decidedOutcome = { approve: "approved", reject: "rejected", suspend: "suspended", reinstate: "reinstated" } as const;

export const reviewOutcomes = { approved: "review.outcome.approved", rejected: "review.outcome.rejected",
  suspended: "review.outcome.suspended", reinstated: "review.outcome.reinstated", conflict: "review.outcome.conflict",
  missing: "review.outcome.missing", invalid: "review.outcome.invalid", reasonRequired: "review.outcome.reasonRequired",
  signedOut: "account.signedOut", expired: "account.expired", forbidden: "admin.denied", unavailable: "account.unavailable",
} as const satisfies Record<string, TranslationKey>;
