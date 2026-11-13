"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formRevision, formVersion } from "@/features/media/form";
import { actionSession } from "@/features/provider-records/session";
import { resubmitApproval } from "@/lib/api/organization";
import { changePublication } from "@/lib/api/profile";
import { isLocale } from "@/lib/i18n";

// Every outcome reloads the page, so the API's latest eligibility, missing parts and version are what the owner sees next.
const reload = (locale: string, state: string): never => {
  revalidatePath(`/${locale}/provider/publication`);
  return redirect(`/${locale}/provider/publication?outcome=${state}#publication-outcome`);
};

// The change is bound by the page but returns from the browser, so it is checked again here.
export async function changePublicationAction(locale: string, change: string, form: FormData) {
  if (!isLocale(locale) || (change !== "publish" && change !== "unpublish")) return;
  const version = formVersion(form);
  if (version === undefined) return reload(locale, "invalid");
  const { session, origin, apply } = await actionSession();
  const result = await changePublication(origin, session, apply, change === "publish", version);
  reload(locale, result.state);
}

// Resubmission returns a rejected application to review; it never publishes anything.
export async function resubmitApplication(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const revision = formRevision(form);
  let state = "invalid";
  if (revision !== undefined) {
    const { session, origin, apply } = await actionSession();
    state = (await resubmitApproval(origin, session, apply, revision)).state;
  }
  revalidatePath(`/${locale}/provider/onboarding`);
  redirect(`/${locale}/provider/onboarding?approval=${state}#approval-outcome`);
}
