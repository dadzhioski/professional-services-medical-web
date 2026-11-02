"use server";

import { PriceCurrencyEnum, type ServiceResponse } from "@dadzhioski/professional-services-api-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionSession } from "@/features/provider-records/session";
import { listLocations } from "@/lib/api/locations";
import { createService, deleteService, listServices, updateService, type ServiceDraft } from "@/lib/api/services";
import type { IdentityState } from "@/lib/api/session-transport";
import { isLocale } from "@/lib/i18n";
import { blankRows, keptEntries, readPriceList, serviceLimits, validateRows, type PriceListState, type PriceRow } from "./fields";
import { parsePriceList } from "./paste";
import { planChanges, rowOf, type Change } from "./plan";

const currencies: readonly string[] = Object.values(PriceCurrencyEnum);

// New and imported rows default to the currency the list already uses.
const listCurrency = (rows: PriceRow[]) => rows.findLast(row => row.amount)?.currency ?? PriceCurrencyEnum.Mkd;

type Applied = { state: "saved"; record: ServiceResponse } | { state: "removed" } | { state: "removedElsewhere" } |
  { state: "conflict"; latest?: ServiceResponse } | { state: "rejected" } | { state: IdentityState };

async function apply(change: Change, origin: string | null, session: string | undefined,
  applySession: Parameters<typeof createService>[2]): Promise<Applied> {
  if (change.kind === "delete") {
    const result = await deleteService(origin, session, applySession, change.serviceId);
    // Already gone counts as removed.
    return result.state === "notFound" ? { state: "removed" } : result;
  }
  const draft = change.draft as ServiceDraft;
  const result = change.kind === "create" ? await createService(origin, session, applySession, draft) :
    await updateService(origin, session, applySession, change.serviceId, draft, change.version);
  if (result.state === "invalid") return { state: "rejected" };
  if (result.state === "notFound") return { state: change.kind === "update" ? "removedElsewhere" : "rejected" };
  return result;
}

// The previous state is client-supplied and never trusted. Row identifiers and versions return from the browser,
// so only their shape is checked here and the API authorizes ownership. Every result echoes the submitted rows.
export async function savePriceList(locale: string, _previous: unknown, form: FormData): Promise<PriceListState> {
  const { rows, forged, paste } = readPriceList(form);
  const intent = form.get("intent");
  const kept: PriceListState = { status: "idle", rows, paste, blanks: blankRows.initial, errors: {}, outcomes: {} };
  if (!isLocale(locale) || forged) return { ...kept, status: "forbidden" };
  if (intent === "more") return { ...kept, blanks: blankRows.more };
  if (intent === "import") {
    const imported = parsePriceList(paste, listCurrency(rows));
    if (!imported.length) return { ...kept, status: "importedNone" };
    const all = [...rows, ...imported];
    // Rows marked for removal still occupy the form until saved, so they count here.
    if (all.length > serviceLimits.entries) return { ...kept, status: "tooMany" };
    return { ...kept, rows: all, paste: "", status: "imported" };
  }
  // Text left in the paste box would be lost by the reload after saving, so the doctor adds or clears it first.
  if (paste.trim()) return { ...kept, status: "pastePending" };
  const errors = validateRows(rows, currencies);
  if (Object.keys(errors).length) return { ...kept, status: "invalid", errors };
  if (keptEntries(rows) > serviceLimits.entries) return { ...kept, status: "tooMany" };

  const { session, origin, apply: applySession } = await actionSession();
  // The current list is re-read on the server, so linked locations and the change set never come from the browser.
  const [services, locations] = await Promise.all([listServices(session), listLocations(session)]);
  if (services.state !== "ready") return { ...kept, status: services.state };
  if (locations.state !== "ready") return { ...kept, status: locations.state };
  const { changes, removedElsewhere, alreadyRemoved } = planChanges(rows, services.records, locations.records.map(location => location.locationId!));

  const next = rows.map(row => ({ ...row }));
  const outcomes: PriceListState["outcomes"] = {};
  const removed = new Set<number>(alreadyRemoved);
  // A row removed elsewhere stays as a new entry; saving again adds it back only by the doctor's choice.
  const asNew = (index: number) => {
    next[index] = { ...next[index], serviceId: undefined, version: undefined };
    outcomes[index] = { outcome: "removedElsewhere" };
  };
  removedElsewhere.forEach(asNew);
  let stopped: IdentityState | undefined;
  let saved = false;
  // Each call may rotate the session; later rows use the latest value, and a cleared session stops processing.
  let current = session;
  const rotate: typeof applySession = cookie => { applySession(cookie); current = cookie.maxAge === 0 ? undefined : cookie.value; };
  for (const change of changes) {
    const result = await apply(change, origin, current, rotate);
    const index = change.index;
    if (result.state === "saved") { next[index] = rowOf(result.record, listCurrency(rows)); saved = true; }
    else if (result.state === "removed") { removed.add(index); saved = true; }
    else if (result.state === "removedElsewhere") asNew(index);
    else if (result.state === "rejected") outcomes[index] = { outcome: "rejected" };
    else if (result.state === "conflict") {
      // Adopting the latest version keeps the doctor's input; saving again is the explicit overwrite.
      if (result.latest?.version !== undefined) next[index] = { ...next[index], version: result.latest.version };
      outcomes[index] = { outcome: "conflict", latest: result.latest && { name: result.latest.name ?? "",
        description: result.latest.description ?? "", amount: result.latest.price?.amount, currency: result.latest.price?.currency } };
    } else { stopped = result.state; break; }
  }

  const path = `/${locale}/provider/services`;
  if (saved) revalidatePath(path);
  // Reload from the API so the list, checklist and publication status are current.
  if (!stopped && Object.keys(outcomes).length === 0) redirect(`${path}?notice=saved`);
  const remaining: PriceRow[] = [];
  const remapped: PriceListState["outcomes"] = {};
  next.forEach((row, index) => {
    if (removed.has(index)) return;
    if (outcomes[index]) remapped[remaining.length] = outcomes[index];
    remaining.push(row);
  });
  return { ...kept, status: stopped ?? "partial", rows: remaining, outcomes: remapped };
}
