import type { TranslationKey } from "@/lib/i18n/en";
import { identifierPattern, text, versions, type RecordState } from "@/features/provider-records/form";

// Bounds from the published 0.3.0 CreateLocationRequest contract; the API remains authoritative.
export const locationLimits = { label: 120, displayAddress: 255 } as const;

export type LocationValues = { label: string; countryCode: string; cityId: string; displayAddress: string };
export type LocationEditorState = RecordState<LocationValues>;

export const locationMessageKeys = [
  "providerLocations.label", "providerLocations.labelHint", "providerLocations.country", "providerLocations.city",
  "providerLocations.cityHint", "providerLocations.address", "providerLocations.addressHint", "providerLocations.choose",
  "providerLocations.retired", "providerLocations.save", "providerLocations.create",
] as const satisfies readonly TranslationKey[];
export type LocationMessages = Record<(typeof locationMessageKeys)[number], string>;

export const emptyLocation: LocationValues = { label: "", countryCode: "", cityId: "", displayAddress: "" };

// `cityCountry` maps listed city IDs to their country, for an early usability check only.
export function readLocationForm(form: FormData, cityCountry: ReadonlyMap<string, string>) {
  const values: LocationValues = { label: text(form, "label"), countryCode: text(form, "countryCode"),
    cityId: text(form, "cityId"), displayAddress: text(form, "displayAddress") };
  const errors: LocationEditorState["errors"] = {};
  if (values.label.length > locationLimits.label) errors.label = "tooLong";
  if (!/^[A-Z]{2}$/.test(values.countryCode)) errors.countryCode = "required";
  if (!identifierPattern.test(values.cityId)) errors.cityId = "required";
  // Unlisted (for example retired) cities are left to the API, which remains authoritative.
  else if (!errors.countryCode && cityCountry.has(values.cityId) && cityCountry.get(values.cityId) !== values.countryCode) errors.cityId = "mismatch";
  if (!values.displayAddress.trim()) errors.displayAddress = "required";
  else if (values.displayAddress.length > locationLimits.displayAddress) errors.displayAddress = "tooLong";
  return { values, errors, ...versions(form) };
}

export function locationDraft(values: LocationValues) {
  return { label: values.label || undefined, countryCode: values.countryCode, cityId: values.cityId, displayAddress: values.displayAddress };
}
