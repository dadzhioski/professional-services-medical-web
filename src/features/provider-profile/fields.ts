import type { TranslationKey } from "@/lib/i18n/en";

// maxLength from the published 0.3.0 EditProfileRequest contract; the API remains authoritative.
export const profileLimits = { displayName: 255, biography: 2000 } as const;
// maxLength from the published 0.9.0 QualificationsRequest contract (after line-ending normalization).
export const qualificationLimits = { education: 4000, specialties: 4000, certificates: 4000 } as const;
export type ProfileField = keyof typeof profileLimits;
export type QualificationField = keyof typeof qualificationLimits;
export type ProfileValues = Record<ProfileField, string>;
export type QualificationValues = Record<QualificationField, string>;
export type EditorStatus = "idle" | "saved" | "invalid" | "conflict" | "signedOut" | "expired" | "forbidden" | "unavailable";
export type TextValues = Record<string, string>;
export type EditorState<Values extends TextValues = ProfileValues> = {
  status: EditorStatus; values: Values; version: number;
  latest?: Values & { version: number }; errors: Partial<Record<keyof Values, "tooLong">>;
};
export type LatestProfile = ProfileValues & { version: number };

export const editorMessageKeys = [
  "profileEditor.tooLong", "profileEditor.saving", "profileEditor.saved", "profileEditor.problem",
  "profileEditor.invalid", "profileEditor.conflict", "profileEditor.latestHeading", "profileEditor.overwrite",
  "profileEditor.discard", "profileEditor.empty", "profileEditor.keptInput", "account.signedOut", "account.expired",
  "account.forbidden", "account.unavailable", "account.login",
] as const satisfies readonly TranslationKey[];
export type EditorMessages = Record<(typeof editorMessageKeys)[number], string>;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  // Browsers submit textarea line breaks as CRLF; count them as the user saw them.
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
};
const integer = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : undefined;

// Provider-authored text is kept exactly as supplied; only contract limits are checked, after trimming where the
// API trims before its own limit.
function readTextForm<Field extends string>(form: FormData, limits: Record<Field, number>, trimmed = false) {
  const fields = Object.keys(limits) as Field[];
  const values = Object.fromEntries(fields.map(field => [field, text(form, field)])) as Record<Field, string>;
  const errors: Partial<Record<Field, "tooLong">> = {};
  for (const field of fields) if ((trimmed ? values[field].trim() : values[field]).length > limits[field]) errors[field] = "tooLong";
  // Overwriting a newer version is only possible through the explicit conflict choice.
  return { values, errors, version: integer(form.get("version")), overwriteVersion: integer(form.get("overwriteVersion")) };
}

export const readProfileForm = (form: FormData) => readTextForm(form, profileLimits);
export const readQualificationsForm = (form: FormData) => readTextForm(form, qualificationLimits, true);

const publicationKeys = {
  DRAFT: "profileEditor.publication.draft",
  PUBLISHED: "profileEditor.publication.published",
  UNPUBLISHED: "profileEditor.publication.unpublished",
} as const;

// Present API-provided states only; the contract types this as a plain string.
export function publicationKey(state: string | undefined) {
  return state && Object.hasOwn(publicationKeys, state) ? publicationKeys[state as keyof typeof publicationKeys] : "profileEditor.publication.unknown";
}
