import type { TranslationKey } from "@/lib/i18n/en";
import { imageLimits } from "./limits";

const shared = {
  noFile: "media.missing", tooLarge: "media.tooLarge", unsupported: "media.unsupported", invalid: "media.invalid",
  busy: "media.busy", signedOut: "account.signedOut", expired: "account.expired", forbidden: "account.forbidden",
  unavailable: "account.unavailable",
} as const satisfies Record<string, TranslationKey>;

export const photoOutcomes = { ...shared, saved: "photo.saved", removed: "photo.removed", conflict: "photo.conflict" } as const;
export const evidenceOutcomes = { ...shared, saved: "evidence.saved", removed: "evidence.removed",
  conflict: "evidence.conflict", full: "evidence.full", missing: "evidence.missingCredential" } as const;

// Outcomes arrive in the query string, so only allow-listed values become messages.
export function outcomeMessage<T extends Record<string, TranslationKey>>(outcomes: T, value: unknown) {
  if (typeof value !== "string" || !Object.hasOwn(outcomes, value)) return undefined;
  return { key: outcomes[value] as T[keyof T], success: value === "saved" || value === "removed" };
}

const integer = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : undefined;
export const formVersion = (form: FormData) => integer(form.get("version"));

// A user-chosen file worth sending: present, non-empty and within the byte limit.
export function selectedImage(value: FormDataEntryValue | null): Blob | "noFile" | "tooLarge" {
  if (!value || typeof value === "string" || value.size === 0) return "noFile";
  return value.size > imageLimits.maxBytes ? "tooLarge" : value;
}
