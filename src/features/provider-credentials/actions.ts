"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formVersion, selectedImage } from "@/features/media/form";
import type { RecordStatus } from "@/features/provider-records/form";
import { actionSession } from "@/features/provider-records/session";
import { addEvidence, createCredential, deleteCredential, removeEvidence, submitForReview, updateCredentialFields,
  type Credential } from "@/lib/api/credentials";
import { isUuid } from "@/lib/api/media";
import { isLocale } from "@/lib/i18n";
import { credentialDraft, dateText, readCredentialForm, type CredentialEditorState, type CredentialValues } from "./fields";

// Every outcome reloads the server-rendered page, so credentials, states and versions shown are always current.
const back = (locale: string, state: string): never => redirect(`/${locale}/provider/credentials?evidence=${state}#evidence-outcome`);
const reload = (locale: string, state: string): never => {
  revalidatePath(`/${locale}/provider/credentials`);
  return redirect(`/${locale}/provider/credentials?credential=${state}#credential-outcome`);
};
const text = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };

export async function addCredentialEvidence(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  const file = selectedImage(form.get("evidence"));
  if (version === undefined) return back(locale, "invalid");
  if (typeof file === "string") return back(locale, file);
  const { session, origin, apply } = await actionSession();
  const result = await addEvidence(origin, session, apply, text(form, "credentialId"), version, file);
  back(locale, result.state);
}

export async function removeCredentialEvidence(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  if (version === undefined) return back(locale, "invalid");
  const { session, origin, apply } = await actionSession();
  const result = await removeEvidence(origin, session, apply, text(form, "credentialId"), version, text(form, "mediaId"));
  back(locale, result.state);
}

// Only owner-visible fields and the version reach the browser; evidence and review data stay on the page.
function valuesOf(credential: Credential): CredentialValues & { version: number } {
  return { type: credential.type, title: credential.title, issuer: credential.issuer, issuedOn: dateText(credential.issuedOn),
    expiresOn: dateText(credential.expiresOn), version: credential.version };
}

// The previous state is client-supplied and never trusted; submitted values are always returned.
// `credentialId` is bound by the page but returns from the browser, so only its shape is checked here and
// the API authorizes ownership (an unknown or foreign ID is not found).
export async function saveCredential(locale: string, credentialId: string | undefined, _previous: unknown,
  form: FormData): Promise<CredentialEditorState> {
  const { values, errors, version, overwriteVersion } = readCredentialForm(form);
  // A failed overwrite keeps the stale version, so overwriting always needs a fresh explicit choice.
  const kept = { values, version, errors };
  const target = overwriteVersion ?? version;
  if (!isLocale(locale) || (credentialId !== undefined && !isUuid(credentialId))) return { ...kept, status: "forbidden" };
  if (Object.keys(errors).length || (credentialId !== undefined && target === undefined)) return { ...kept, status: "invalid" };
  const { session, origin, apply } = await actionSession();
  const draft = credentialDraft(values);
  if (credentialId === undefined) {
    const created = await createCredential(origin, session, apply, draft);
    if (created.state === "saved") reload(locale, "created");
    // Creation has no version to be stale against.
    const status: RecordStatus = created.state === "invalid" ? "rejected" : created.state === "conflict" ? "unavailable" : created.state;
    return { ...kept, status };
  }
  const result = await updateCredentialFields(origin, session, apply, credentialId, draft, target!);
  if (result.state === "saved") reload(locale, "saved");
  if (result.state === "conflict") return { ...kept, status: "conflict", latest: result.latest && valuesOf(result.latest) };
  const status: RecordStatus = result.state === "invalid" ? "rejected" : result.state === "saved" ? "saved" : result.state;
  return { ...kept, status };
}

export async function submitCredential(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  if (version === undefined) return reload(locale, "invalid");
  const { session, origin, apply } = await actionSession();
  const result = await submitForReview(origin, session, apply, text(form, "credentialId"), version);
  reload(locale, result.state);
}

export async function removeCredential(locale: string, credentialId: string, version: number) {
  if (!isLocale(locale)) return;
  const { session, origin, apply } = await actionSession();
  const result = await deleteCredential(origin, session, apply, credentialId, version);
  reload(locale, result.state);
}
