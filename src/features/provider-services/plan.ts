import type { ServiceResponse } from "@dadzhioski/professional-services-api-client";
import { serviceDraft, serviceLimits, type PriceRow } from "./fields";

// Only owner-visible content and the version reach the browser; an unpriced entry shows the fallback currency.
export const rowOf = (service: ServiceResponse, fallbackCurrency: string): PriceRow => ({ serviceId: service.serviceId,
  version: service.version, name: service.name ?? "", description: service.description ?? "", amount: service.price?.amount ?? "",
  currency: service.price?.currency ?? fallbackCurrency, remove: false });

type Draft = ReturnType<typeof serviceDraft>;
export type Change = { kind: "update"; index: number; serviceId: string; version: number; draft: Draft } |
  { kind: "create"; index: number; draft: Draft } | { kind: "delete"; index: number; serviceId: string };

const changed = (row: PriceRow, service: ServiceResponse) => row.name !== (service.name ?? "") ||
  row.description !== (service.description ?? "") || row.amount !== (service.price?.amount ?? "") ||
  (!!row.amount && row.currency !== service.price?.currency);

// Compares the submitted rows with the API's current list. Only changed rows become calls; updates keep the
// entry's linked locations and new entries are linked to every practice location (API maximum per service).
// Rows whose entry no longer exists are reported, never sent, so a removal elsewhere is not silently undone.
export function planChanges(rows: PriceRow[], current: ServiceResponse[], locationIds: string[]) {
  const byId = new Map(current.map(service => [service.serviceId, service]));
  const updates: Change[] = [], creates: Change[] = [], deletes: Change[] = [];
  const removedElsewhere: number[] = [], alreadyRemoved: number[] = [];
  rows.forEach((row, index) => {
    const existing = row.serviceId === undefined ? undefined : byId.get(row.serviceId);
    if (row.serviceId !== undefined && !existing) {
      (row.remove ? alreadyRemoved : removedElsewhere).push(index);
    } else if (existing && row.remove) deletes.push({ kind: "delete", index, serviceId: row.serviceId! });
    else if (existing) {
      if (changed(row, existing)) updates.push({ kind: "update", index, serviceId: row.serviceId!, version: row.version!,
        draft: serviceDraft(row, existing.locationIds ?? []) });
    } else creates.push({ kind: "create", index, draft: serviceDraft(row, locationIds.slice(0, serviceLimits.locations)) });
  });
  // Creating before deleting keeps a published list from passing through empty; at the API cap, deletes free room first.
  const changes = current.length + creates.length > serviceLimits.entries ?
    [...updates, ...deletes, ...creates] : [...updates, ...creates, ...deletes];
  return { changes, removedElsewhere, alreadyRemoved };
}
