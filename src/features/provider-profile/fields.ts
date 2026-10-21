import type { TranslationKey } from "@/lib/i18n/en";

// maxLength from the published 0.3.0 EditProfileRequest contract; the API remains authoritative.
export const profileLimits = { displayName: 255, biography: 2000 } as const;
export type ProfileField = keyof typeof profileLimits;
export type ProfileValues = Record<ProfileField, string>;
export type EditorStatus = "idle" | "saved" | "invalid" | "conflict" | "signedOut" | "expired" | "forbidden" | "unavailable";
export type LatestProfile = ProfileValues & { version: number };
export type EditorState = {
  status: EditorStatus; values: ProfileValues; version: number;
  latest?: LatestProfile; errors: Partial<Record<ProfileField, "tooLong">>;
};

export const editorMessageKeys = [
  "profileEditor.displayName", "profileEditor.displayNameHint", "profileEditor.biography", "profileEditor.biographyHint",
  "profileEditor.tooLong", "profileEditor.save", "profileEditor.saving", "profileEditor.saved", "profileEditor.problem",
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

// Provider-authored text is kept exactly as supplied; only contract limits are checked.
export function readProfileForm(form: FormData) {
  const values: ProfileValues = { displayName: text(form, "displayName"), biography: text(form, "biography") };
  const errors: EditorState["errors"] = {};
  for (const field of Object.keys(profileLimits) as ProfileField[]) {
    if (values[field].length > profileLimits[field]) errors[field] = "tooLong";
  }
  // Overwriting a newer version is only possible through the explicit conflict choice.
  return { values, errors, version: integer(form.get("version")), overwriteVersion: integer(form.get("overwriteVersion")) };
}

const publicationKeys = {
  DRAFT: "profileEditor.publication.draft",
  PUBLISHED: "profileEditor.publication.published",
  UNPUBLISHED: "profileEditor.publication.unpublished",
} as const;

// Present API-provided states only; the contract types this as a plain string.
export function publicationKey(state: string | undefined) {
  return state && Object.hasOwn(publicationKeys, state) ? publicationKeys[state as keyof typeof publicationKeys] : "profileEditor.publication.unknown";
}
