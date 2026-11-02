import { identifierPattern, integer, text, type FieldError } from "@/features/provider-records/form";
import type { TranslationKey } from "@/lib/i18n/en";
import { amountPattern } from "@/lib/price";

// Bounds from the published CreateServiceRequest/Price contract and the API's 50-service cap; the API remains authoritative.
export const serviceLimits = { name: 120, description: 1000, locations: 10, entries: 50, paste: 20000 } as const;
// Empty rows shown below the list, and how many more one "add rows" submission gives.
export const blankRows = { initial: 3, more: 10 } as const;

// One price-list row. Existing entries carry the API identifier and the version the form was rendered with.
export type PriceRow = {
  serviceId?: string; version?: number; name: string; description: string; amount: string; currency: string; remove: boolean;
};
export type RowField = "name" | "description" | "amount" | "currency";
export type RowOutcome = "conflict" | "rejected" | "removedElsewhere";
export type PriceListStatus = "idle" | "imported" | "importedNone" | "pastePending" | "invalid" | "partial" | "tooMany" |
  "signedOut" | "expired" | "forbidden" | "unavailable";
export type LatestEntry = { name: string; description?: string; amount?: string; currency?: string };
export type PriceListState = {
  status: PriceListStatus; rows: PriceRow[]; blanks: number; paste: string;
  errors: Record<number, Partial<Record<RowField, FieldError>>>;
  outcomes: Record<number, { outcome: RowOutcome; latest?: LatestEntry }>;
};

export const serviceMessageKeys = [
  "providerServices.entry", "providerServices.name", "providerServices.amount", "providerServices.currency",
  "providerServices.details", "providerServices.detailsHint", "providerServices.remove", "providerServices.rowsHint",
  "providerServices.suggestedFirst", "providerServices.save", "providerServices.more", "providerServices.pasteHeading",
  "providerServices.pasteLabel", "providerServices.pasteHint", "providerServices.pasteAdd", "providerServices.imported",
  "providerServices.importedNone", "providerServices.pastePending", "providerServices.partial", "providerServices.tooMany", "providerServices.rowConflict",
  "providerServices.rowLatest", "providerServices.rowOverwrite", "providerServices.rowRejected", "providerServices.rowRemovedElsewhere",
  "providerServices.priceOnRequest",
] as const satisfies readonly TranslationKey[];
export type ServiceMessages = Record<(typeof serviceMessageKeys)[number], string>;

export const isBlank = (row: PriceRow, suggested = "") => !row.serviceId && (!row.name.trim() || row.name === suggested) &&
  !row.description.trim() && !row.amount.trim();

// A single comma decimal ("120,50") is how many doctors type prices; it means the same as the contract's dot.
const normalizeAmount = (amount: string) => /^\d+,\d{1,2}$/.test(amount) ? amount.replace(",", ".") : amount;

// Rows arrive by index; fully empty new rows are dropped. `forged` marks identifiers or versions that
// no rendered form could have produced, so the whole submission is refused.
export function readPriceList(form: FormData) {
  const count = Math.min(integer(form.get("rows")) ?? 0, serviceLimits.entries + blankRows.more);
  const rows: PriceRow[] = [];
  let forged = false;
  for (let index = 0; index < count; index++) {
    const serviceId = text(form, `serviceId-${index}`) || undefined;
    const version = integer(form.get(`version-${index}`));
    if (serviceId !== undefined && (!identifierPattern.test(serviceId) || version === undefined)) forged = true;
    const row: PriceRow = { serviceId, version: serviceId === undefined ? undefined : version,
      name: text(form, `name-${index}`), description: text(form, `description-${index}`),
      amount: normalizeAmount(text(form, `amount-${index}`).trim()), currency: text(form, `currency-${index}`),
      remove: serviceId !== undefined && form.get(`remove-${index}`) === "on" };
    // The prefilled suggestion only becomes an entry once the doctor gives it a price or description.
    if (!isBlank(row, text(form, `suggested-${index}`))) rows.push(row);
  }
  return { rows, forged, paste: text(form, "paste").slice(0, serviceLimits.paste) };
}

// Provider-authored text is kept exactly as supplied; only contract bounds are checked for usability.
export function validateRows(rows: PriceRow[], currencies: readonly string[]) {
  const errors: PriceListState["errors"] = {};
  rows.forEach((row, index) => {
    if (row.remove) return;
    const error: Partial<Record<RowField, FieldError>> = {};
    if (!row.name.trim()) error.name = "required";
    else if (row.name.length > serviceLimits.name) error.name = "tooLong";
    if (row.description.length > serviceLimits.description) error.description = "tooLong";
    if (row.amount && !amountPattern.test(row.amount)) error.amount = "format";
    if (row.amount && !currencies.includes(row.currency)) error.currency = "required";
    if (Object.keys(error).length) errors[index] = error;
  });
  return errors;
}

export const keptEntries = (rows: PriceRow[]) => rows.filter(row => !row.remove).length;

// An empty amount means no price; a supplied price is forwarded exactly as typed.
export function serviceDraft(row: PriceRow, locationIds: string[]) {
  return { name: row.name, description: row.description || undefined, locationIds,
    price: row.amount ? { amount: row.amount, currency: row.currency } : undefined };
}
