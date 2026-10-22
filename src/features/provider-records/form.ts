import type { TranslationKey } from "@/lib/i18n/en";

// Shared editor state for organization-owned records. Values are always echoed back so input survives failures.
export type RecordStatus = "idle" | "saved" | "invalid" | "rejected" | "conflict" | "notFound" |
  "signedOut" | "expired" | "forbidden" | "unavailable";
export type FieldError = "required" | "tooLong" | "format" | "tooMany" | "mismatch";
export type RecordState<V, L = V> = {
  status: RecordStatus; values: V; version?: number; latest?: L & { version: number };
  errors: Partial<Record<keyof V & string, FieldError>>;
};

export const recordMessageKeys = [
  "records.problem", "records.invalid", "records.rejected", "records.conflict", "records.notFound", "records.latestHeading",
  "records.overwrite", "records.discard", "records.keptInput", "records.saving", "records.empty",
  "records.error.required", "records.error.tooLong", "records.error.format", "records.error.tooMany", "records.error.mismatch",
  "account.signedOut", "account.expired", "account.forbidden", "account.unavailable", "account.login",
] as const satisfies readonly TranslationKey[];
export type RecordMessages = Record<(typeof recordMessageKeys)[number], string>;

export const text = (form: FormData, name: string) => {
  const value = form.get(name);
  // Browsers submit textarea line breaks as CRLF; count them as the user saw them.
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
};
export const integer = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : undefined;
// API-issued identifiers are opaque; only their shape is checked before they reach the API.
export const identifierPattern = /^[A-Za-z0-9-]{1,64}$/;

// Overwriting a newer version is only possible through the explicit conflict choice.
export const versions = (form: FormData) => ({ version: integer(form.get("version")), overwriteVersion: integer(form.get("overwriteVersion")) });

// Notices arrive in the query string, so only known values are rendered.
const notices = ["saved", "removed", "notFound", "invalid", "signedOut", "expired", "forbidden", "unavailable"] as const;
export type RecordNotice = (typeof notices)[number];
export const recordNotice = (value: string | undefined): RecordNotice | undefined =>
  notices.find(notice => notice === value);
export const noticeKey = (notice: RecordNotice) => ({
  saved: "records.saved", removed: "records.removed", notFound: "records.notFound", invalid: "records.rejected",
  signedOut: "account.signedOut", expired: "account.expired", forbidden: "account.forbidden", unavailable: "account.unavailable",
} as const)[notice];
