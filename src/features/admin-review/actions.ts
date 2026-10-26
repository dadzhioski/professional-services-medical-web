"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formRevision } from "@/features/media/form";
import { actionSession } from "@/features/provider-records/session";
import { isUuid } from "@/lib/api/media";
import { approveCredential, decideDoctor, rejectCredential, rejectDoctor, type DecisionResult } from "@/lib/api/review";
import { isLocale } from "@/lib/i18n";
import { decidedOutcome, isCredentialDecision, isDoctorDecision } from "./outcomes";

// Every outcome reloads the server-rendered review page, so a stale decision is never resubmitted: the
// administrator sees the latest state and revision and decides again.
const reload = (path: string, state: string): never => {
  revalidatePath(path);
  return redirect(`${path}?outcome=${state}#review-outcome`);
};
const outcome = (result: DecisionResult, decision: keyof typeof decidedOutcome) =>
  result.state === "decided" ? decidedOutcome[decision] : result.state;
// The reason is shown only to the owner; the API trims it again and enforces its own bounds.
const reasonOf = (form: FormData) => { const value = form.get("reason"); return typeof value === "string" ? value.trim() : ""; };

// The target and decision are bound by the page but return from the browser, so both are checked again here.
export async function decideDoctorAction(locale: string, organizationId: string, decision: string, form: FormData) {
  if (!isLocale(locale) || !isUuid(organizationId) || !isDoctorDecision(decision)) return;
  const path = `/${locale}/admin/doctors/${organizationId}`;
  const reviewed = formRevision(form);
  if (reviewed === undefined) return reload(path, "invalid");
  const reason = reasonOf(form);
  if (decision === "reject" && !reason) return redirect(`${path}?decide=reject&outcome=reasonRequired#decision`);
  const { session, origin, apply } = await actionSession();
  const result = decision === "reject" ? await rejectDoctor(origin, session, apply, organizationId, reviewed, reason) :
    await decideDoctor(origin, session, apply, organizationId, decision, reviewed);
  reload(path, outcome(result, decision));
}

export async function decideCredentialAction(locale: string, credentialId: string, decision: string, form: FormData) {
  if (!isLocale(locale) || !isUuid(credentialId) || !isCredentialDecision(decision)) return;
  const path = `/${locale}/admin/credentials/${credentialId}`;
  const reviewed = formRevision(form);
  if (reviewed === undefined) return reload(path, "invalid");
  const reason = reasonOf(form);
  if (decision === "reject" && !reason) return redirect(`${path}?decide=reject&outcome=reasonRequired#decision`);
  const { session, origin, apply } = await actionSession();
  const result = decision === "reject" ? await rejectCredential(origin, session, apply, credentialId, reviewed, reason) :
    await approveCredential(origin, session, apply, credentialId, reviewed);
  reload(path, outcome(result, decision));
}
