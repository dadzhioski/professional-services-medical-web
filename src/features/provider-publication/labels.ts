import type { TranslationKey } from "@/lib/i18n/en";

// Each missing part names what is needed and where the owner can provide it; `anchor` points into that page.
const missingParts = {
  DISPLAY_NAME: { key: "publication.missing.displayName", page: "profile" },
  BIOGRAPHY: { key: "publication.missing.biography", page: "profile" },
  SPECIALTY: { key: "publication.missing.specialty", page: "profile" },
  EDUCATION: { key: "publication.missing.education", page: "profile", anchor: "qualifications" },
  SPECIALTIES: { key: "publication.missing.specialties", page: "profile", anchor: "qualifications" },
  SERVICE: { key: "publication.missing.service", page: "services" },
  PRACTICE_LOCATION: { key: "publication.missing.location", page: "locations" },
} as const satisfies Record<string, { key: TranslationKey; page: string; anchor?: string }>;

// Unknown parts, including the deprecated APPROVED_CREDENTIAL the API no longer returns, are still shown as missing,
// never dropped.
export function missingPart(part: string): { key: TranslationKey; page?: string; anchor?: string } {
  return Object.hasOwn(missingParts, part) ? missingParts[part as keyof typeof missingParts] : { key: "publication.missing.unknown" };
}

export const publicationOutcomes = { published: "publication.outcome.published", unpublished: "publication.outcome.unpublished",
  conflict: "publication.outcome.conflict", incomplete: "publication.outcome.incomplete", missing: "publication.outcome.missing",
  invalid: "records.invalid", signedOut: "account.signedOut", expired: "account.expired", forbidden: "account.forbidden",
  unavailable: "account.unavailable" } as const satisfies Record<string, TranslationKey>;

export const approvalOutcomes = { resubmitted: "workspace.outcome.resubmitted", conflict: "workspace.outcome.conflict",
  invalid: "records.invalid", signedOut: "account.signedOut", expired: "account.expired", forbidden: "account.forbidden",
  unavailable: "account.unavailable" } as const satisfies Record<string, TranslationKey>;
