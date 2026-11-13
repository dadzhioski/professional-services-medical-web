import { CredentialRequestTypeEnum } from "@dadzhioski/professional-services-api-client";
import { text, versions, type RecordState } from "@/features/provider-records/form";
import type { TranslationKey } from "@/lib/i18n/en";

// Bounds from the published 0.7.0 credential contract; the API remains authoritative, including the
// rule that an issue date cannot be in the future (left to the API so web and API clocks never disagree).
export const credentialLimits = { title: 200, issuer: 200, count: 20 } as const;
export const credentialTypes: readonly string[] = Object.values(CredentialRequestTypeEnum);

// Dates are kept as the YYYY-MM-DD strings a date input submits.
export type CredentialValues = { type: string; title: string; issuer: string; issuedOn: string; expiresOn: string };
export type CredentialEditorState = RecordState<CredentialValues>;

export const credentialMessageKeys = [
  "credential.type", "credentials.typeChoose", "credentials.title", "credentials.titleHint", "credentials.issuer",
  "credentials.issuerHint", "credentials.issuedOn", "credentials.issuedOnHint", "credentials.expiresOn", "credentials.expiresOnHint",
  "credentials.noExpiry", "credentials.create", "credentials.save", "credential.type.education", "credential.type.specialization",
  "credential.type.license", "credential.type.certification", "credential.type.other", "credential.type.unknown",
] as const satisfies readonly TranslationKey[];
export type CredentialMessages = Record<(typeof credentialMessageKeys)[number], string>;

export const emptyCredential: CredentialValues = { type: "", title: "", issuer: "", issuedOn: "", expiresOn: "" };

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
// The generated client reads and writes dates as local midnight, so they are built the same way here.
export function toDate(value: string): Date | undefined {
  const match = datePattern.exec(value);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(2000, month - 1, day);
  date.setFullYear(year);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}
export function dateText(value: Date | null | undefined) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const pad = (part: number, size: number) => String(part).padStart(size, "0");
  return `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1, 2)}-${pad(value.getDate(), 2)}`;
}

// Provider-authored text is kept exactly as supplied; only contract bounds are checked for usability.
export function readCredentialForm(form: FormData) {
  const values: CredentialValues = { type: text(form, "type"), title: text(form, "title"), issuer: text(form, "issuer"),
    issuedOn: text(form, "issuedOn").trim(), expiresOn: text(form, "expiresOn").trim() };
  const errors: CredentialEditorState["errors"] = {};
  if (!credentialTypes.includes(values.type)) errors.type = "required";
  for (const field of ["title", "issuer"] as const) {
    if (!values[field].trim()) errors[field] = "required";
    else if (values[field].length > credentialLimits[field]) errors[field] = "tooLong";
  }
  const issued = toDate(values.issuedOn);
  if (!issued) errors.issuedOn = values.issuedOn ? "format" : "required";
  const expires = values.expiresOn ? toDate(values.expiresOn) : undefined;
  if (values.expiresOn && !expires) errors.expiresOn = "format";
  else if (issued && expires && expires < issued) errors.expiresOn = "dateOrder";
  return { values, errors, ...versions(form) };
}

// An empty expiry is omitted, which the contract reads as no expiry.
export function credentialDraft(values: CredentialValues) {
  return { type: values.type as (typeof CredentialRequestTypeEnum)[keyof typeof CredentialRequestTypeEnum], title: values.title,
    issuer: values.issuer, issuedOn: toDate(values.issuedOn)!, expiresOn: values.expiresOn ? toDate(values.expiresOn) : undefined };
}
