import { identifierPattern, text, versions, type RecordState } from "@/features/provider-records/form";
import type { TranslationKey } from "@/lib/i18n/en";
import { amountPattern } from "@/lib/price";

// Bounds from the published 0.3.0 CreateServiceRequest/Price contract; the API remains authoritative.
export const serviceLimits = { name: 120, description: 1000, locations: 10 } as const;
// Amounts are checked as strings against the shared contract pattern, so "0" (free) stays distinct
// from an absent price.

export type ServiceValues = {
  name: string; description: string; priceMode: "none" | "price"; amount: string; currency: string; locationIds: string[];
};
export type ServiceEditorState = RecordState<ServiceValues>;

export const serviceMessageKeys = [
  "providerServices.name", "providerServices.nameHint", "providerServices.details", "providerServices.detailsHint",
  "providerServices.price", "providerServices.priceNone", "providerServices.priceSet", "providerServices.amount",
  "providerServices.amountHint", "providerServices.currency", "providerServices.currencyChoose", "providerServices.locations",
  "providerServices.locationsHint", "providerServices.locationsMissing", "providerServices.locationUnknown",
  "providerServices.priceNotPublished", "providerServices.save", "providerServices.create",
] as const satisfies readonly TranslationKey[];
export type ServiceMessages = Record<(typeof serviceMessageKeys)[number], string>;

export const emptyService: ServiceValues = { name: "", description: "", priceMode: "none", amount: "", currency: "", locationIds: [] };

// Provider-authored text is kept exactly as supplied; only contract bounds are checked for usability.
export function readServiceForm(form: FormData, currencies: readonly string[]) {
  const values: ServiceValues = {
    name: text(form, "name"), description: text(form, "description"),
    priceMode: form.get("priceMode") === "price" ? "price" : "none",
    amount: text(form, "amount").trim(), currency: text(form, "currency"),
    locationIds: [...new Set(form.getAll("locationIds").filter((value): value is string => typeof value === "string"))],
  };
  const errors: ServiceEditorState["errors"] = {};
  if (!values.name.trim()) errors.name = "required";
  else if (values.name.length > serviceLimits.name) errors.name = "tooLong";
  if (values.description.length > serviceLimits.description) errors.description = "tooLong";
  if (values.priceMode === "price") {
    if (!amountPattern.test(values.amount)) errors.amount = values.amount ? "format" : "required";
    if (!currencies.includes(values.currency)) errors.currency = "required";
  }
  if (values.locationIds.length > serviceLimits.locations) errors.locationIds = "tooMany";
  else if (!values.locationIds.every(id => identifierPattern.test(id))) errors.locationIds = "format";
  return { values, errors, ...versions(form) };
}

// Absent price stays absent; a supplied price is forwarded exactly as typed.
export function serviceDraft(values: ServiceValues) {
  return {
    name: values.name, description: values.description || undefined, locationIds: values.locationIds,
    price: values.priceMode === "price" ? { amount: values.amount, currency: values.currency } : undefined,
  };
}
