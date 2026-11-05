"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { formVersion, selectedImage } from "@/features/media/form";
import { addProof, removePhoto, removeProof, replacePhoto } from "@/lib/api/profile";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";

async function session() {
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  return { jar, session: incomingSession(jar.getAll(), name), origin: (await headers()).get("origin") };
}

// Every outcome reloads the server-rendered page, so the photo and profile version shown are always current.
const back = (locale: string, state: string): never => redirect(`/${locale}/provider/profile?photo=${state}#photo`);

export async function changeProfilePhoto(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  const file = selectedImage(form.get("photo"));
  if (version === undefined) return back(locale, "invalid");
  if (typeof file === "string") return back(locale, file);
  const { jar, session: current, origin } = await session();
  const result = await replacePhoto(origin, current, cookie => jar.set(cookie), version, file);
  back(locale, result.state);
}

export async function removeProfilePhoto(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  if (version === undefined) return back(locale, "invalid");
  const { jar, session: current, origin } = await session();
  const result = await removePhoto(origin, current, cookie => jar.set(cookie), version);
  back(locale, result.state);
}

// Proof outcomes return to the proof section; images are uploaded only with the purpose the API expects.
const proofBack = (locale: string, state: string): never => redirect(`/${locale}/provider/profile?proof=${state}#proofs`);

export async function addProfileProof(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  const file = selectedImage(form.get("proof"));
  if (version === undefined) return proofBack(locale, "invalid");
  if (typeof file === "string") return proofBack(locale, file);
  const { jar, session: current, origin } = await session();
  const result = await addProof(origin, current, cookie => jar.set(cookie), version, file);
  proofBack(locale, result.state);
}

// The media ID returns from the browser, so only its shape is checked and it must be in the API's current list.
export async function removeProfileProof(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  const mediaId = form.get("mediaId");
  if (version === undefined || typeof mediaId !== "string") return proofBack(locale, "invalid");
  const { jar, session: current, origin } = await session();
  const result = await removeProof(origin, current, cookie => jar.set(cookie), version, mediaId);
  proofBack(locale, result.state);
}
