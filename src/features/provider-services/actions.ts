"use server";

import { PriceCurrencyEnum, type ServiceResponse } from "@dadzhioski/professional-services-api-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { identifierPattern, type RecordStatus } from "@/features/provider-records/form";
import { actionSession } from "@/features/provider-records/session";
import { createService, deleteService, updateService, type ServiceDraft } from "@/lib/api/services";
import { isLocale } from "@/lib/i18n";
import { readServiceForm, serviceDraft, type ServiceEditorState, type ServiceValues } from "./fields";

const currencies = Object.values(PriceCurrencyEnum);

// Only owner-visible content and the version reach the browser.
function valuesOf(service: ServiceResponse): ServiceValues & { version: number } {
  return { name: service.name ?? "", description: service.description ?? "", priceMode: service.price ? "price" : "none",
    amount: service.price?.amount ?? "", currency: service.price?.currency ?? "", locationIds: service.locationIds ?? [],
    version: service.version! };
}

// The previous state is client-supplied and never trusted; submitted values are always returned.
// `serviceId` is bound by the page but returns from the browser, so it is untrusted: only its shape is checked
// here and the API authorizes ownership (an unknown or foreign ID is not found).
export async function saveService(locale: string, serviceId: string | undefined, _previous: unknown,
  form: FormData): Promise<ServiceEditorState> {
  const { values, errors, version, overwriteVersion } = readServiceForm(form, currencies);
  // A failed overwrite keeps the stale version, so overwriting always needs a fresh explicit choice.
  const kept = { values, version, errors };
  const target = overwriteVersion ?? version;
  if (!isLocale(locale) || (serviceId !== undefined && !identifierPattern.test(serviceId))) return { ...kept, status: "forbidden" };
  if (Object.keys(errors).length || (serviceId !== undefined && target === undefined)) return { ...kept, status: "invalid" };
  const { session, origin, apply } = await actionSession();
  const draft = serviceDraft(values) as ServiceDraft;
  const result = serviceId === undefined ? await createService(origin, session, apply, draft) :
    await updateService(origin, session, apply, serviceId, draft, target!);
  const path = `/${locale}/provider/services`;
  if (result.state === "saved") {
    revalidatePath(path);
    // Reload from the API so the list, links and publication status are current.
    redirect(`${path}?notice=saved`);
  }
  if (result.state === "conflict") return { ...kept, status: "conflict", latest: result.latest && valuesOf(result.latest) };
  const status: RecordStatus = result.state === "invalid" ? "rejected" : result.state;
  return { ...kept, status };
}

export async function removeService(locale: string, serviceId: string) {
  if (!isLocale(locale) || !identifierPattern.test(serviceId)) return;
  const { session, origin, apply } = await actionSession();
  const result = await deleteService(origin, session, apply, serviceId);
  const path = `/${locale}/provider/services`;
  if (result.state === "removed") revalidatePath(path);
  redirect(`${path}?notice=${result.state}`);
}
