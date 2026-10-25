"use server";

import type { ProfileResponse } from "@dadzhioski/professional-services-api-client";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createProfile, saveProfile } from "@/lib/api/profile";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";
import { saveSpecialty } from "@/lib/api/medical";
import { readProfileForm, type EditorState, type LatestProfile } from "./fields";
import { readSpecialtyForm, type SpecialtyEditorState } from "./specialty";

async function session() {
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  return { jar, session: incomingSession(jar.getAll(), name), origin: (await headers()).get("origin") };
}

// Only owner-visible content and the version reach the browser; internal identifiers do not.
function latestOf(profile: ProfileResponse): LatestProfile {
  return { displayName: profile.displayName ?? "", biography: profile.biography ?? "", version: profile.version! };
}

// Only the specialty and the version reach the browser; licence details stay server-side.
export async function saveProfileSpecialty(locale: string, _previous: unknown, form: FormData): Promise<SpecialtyEditorState> {
  const { values, errors, version, overwriteVersion } = readSpecialtyForm(form);
  const kept = { values, version, errors };
  if (!isLocale(locale)) return { ...kept, status: "forbidden" };
  if (Object.keys(errors).length) return { ...kept, status: "invalid" };
  // Keeping "no specialty" when no medical extension exists changes nothing, so none is created as a side effect.
  if (!values.specialtyId && version === undefined && overwriteVersion === undefined) return { ...kept, status: "saved" };
  const { jar, session: current, origin } = await session();
  const result = await saveSpecialty(origin, current, cookie => jar.set(cookie), values.specialtyId || undefined,
    overwriteVersion ?? version);
  if (result.state === "saved") {
    // Refreshes the page, including any publication change the API reports.
    revalidatePath(`/${locale}/provider/profile`);
    return { status: "saved", values: { specialtyId: result.record.specialtyId ?? "" }, version: result.record.version, errors: {} };
  }
  if (result.state === "conflict") return { ...kept, status: "conflict",
    latest: result.latest && { specialtyId: result.latest.specialtyId ?? "", version: result.latest.version! } };
  return { ...kept, status: result.state === "invalid" ? "rejected" : result.state };
}

// Submitted form fields are ignored: the API derives the profile from the session.
export async function createProfileDraft(locale: string) {
  if (!isLocale(locale)) return;
  const { jar, session: current, origin } = await session();
  const state = await createProfile(origin, current, cookie => jar.set(cookie));
  redirect(state === "ready" ? `/${locale}/provider/profile` : `/${locale}/provider/profile?notice=${state}`);
}

// The previous state is client-supplied and never trusted; submitted values are always returned.
export async function saveProfileDraft(locale: string, _previous: unknown, form: FormData): Promise<EditorState> {
  const { values, errors, version, overwriteVersion } = readProfileForm(form);
  // A failed overwrite keeps the stale version, so overwriting always needs a fresh explicit choice.
  const kept = { values, version: version ?? 0, errors };
  const target = overwriteVersion ?? version;
  if (!isLocale(locale)) return { ...kept, status: "forbidden" };
  if (Object.keys(errors).length || target === undefined) return { ...kept, status: "invalid" };
  const { jar, session: current, origin } = await session();
  const result = await saveProfile(origin, current, cookie => jar.set(cookie), { ...values, version: target });
  if (result.state === "saved") {
    revalidatePath(`/${locale}/provider/profile`);
    const saved = latestOf(result.profile);
    return { status: "saved", values: { displayName: saved.displayName, biography: saved.biography }, version: saved.version, errors: {} };
  }
  if (result.state === "conflict") return { ...kept, status: "conflict", latest: result.latest && latestOf(result.latest) };
  return { ...kept, status: result.state };
}
