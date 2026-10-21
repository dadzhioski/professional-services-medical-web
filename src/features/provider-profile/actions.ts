"use server";

import type { ProfileResponse } from "@dadzhioski/professional-services-api-client";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createProfile, saveProfile } from "@/lib/api/profile";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";
import { readProfileForm, type EditorState, type LatestProfile } from "./fields";

async function session() {
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  return { jar, session: incomingSession(jar.getAll(), name), origin: (await headers()).get("origin") };
}

// Only owner-visible content and the version reach the browser; internal identifiers do not.
function latestOf(profile: ProfileResponse): LatestProfile {
  return { displayName: profile.displayName ?? "", biography: profile.biography ?? "", version: profile.version! };
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
