"use server";

import type { PracticeLocationResponse } from "@dadzhioski/professional-services-api-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { identifierPattern, type RecordStatus } from "@/features/provider-records/form";
import { actionSession } from "@/features/provider-records/session";
import { createLocation, deleteLocation, updateLocation } from "@/lib/api/locations";
import { listCities } from "@/lib/api/reference";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";
import { locationDraft, readLocationForm, type LocationEditorState, type LocationValues } from "./fields";

function valuesOf(location: PracticeLocationResponse): LocationValues & { version: number } {
  return { label: location.label ?? "", countryCode: location.countryCode ?? "", cityId: location.cityId ?? "",
    displayAddress: location.displayAddress ?? "", version: location.version! };
}

// The previous state is client-supplied and never trusted; submitted values are always returned.
// `locationId` is bound by the page but returns from the browser, so it is untrusted: only its shape is checked
// here and the API authorizes ownership (an unknown or foreign ID is not found).
export async function saveLocation(locale: string, locationId: string | undefined, _previous: unknown,
  form: FormData): Promise<LocationEditorState> {
  const { session, origin, apply } = await actionSession();
  // Cross-site submissions are refused by the mutation itself; they never trigger reference reads.
  const cities = origin === getServerEnvironment().publicOrigin ? await listCities() : undefined;
  const cityCountry = new Map(cities?.state === "ready" ? cities.records.map(city => [city.id!, city.countryCode!]) : []);
  const { values, errors, version, overwriteVersion } = readLocationForm(form, cityCountry);
  // A failed overwrite keeps the stale version, so overwriting always needs a fresh explicit choice.
  const kept = { values, version, errors };
  const target = overwriteVersion ?? version;
  if (!isLocale(locale) || (locationId !== undefined && !identifierPattern.test(locationId))) return { ...kept, status: "forbidden" };
  if (Object.keys(errors).length || (locationId !== undefined && target === undefined)) return { ...kept, status: "invalid" };
  const draft = locationDraft(values);
  const result = locationId === undefined ? await createLocation(origin, session, apply, draft) :
    await updateLocation(origin, session, apply, locationId, draft, target!);
  const path = `/${locale}/provider/locations`;
  if (result.state === "saved") {
    revalidatePath(path);
    revalidatePath(`/${locale}/provider/services`);
    // Reload from the API so the list and publication status are current.
    redirect(`${path}?notice=saved`);
  }
  if (result.state === "conflict") return { ...kept, status: "conflict", latest: result.latest && valuesOf(result.latest) };
  const status: RecordStatus = result.state === "invalid" ? "rejected" : result.state;
  return { ...kept, status };
}

export async function removeLocation(locale: string, locationId: string) {
  if (!isLocale(locale) || !identifierPattern.test(locationId)) return;
  const { session, origin, apply } = await actionSession();
  const result = await deleteLocation(origin, session, apply, locationId);
  const path = `/${locale}/provider/locations`;
  if (result.state === "removed") {
    revalidatePath(path);
    revalidatePath(`/${locale}/provider/services`);
  }
  redirect(`${path}?notice=${result.state}`);
}
