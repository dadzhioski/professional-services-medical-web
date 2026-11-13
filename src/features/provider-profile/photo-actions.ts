"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { formVersion, selectedImage } from "@/features/media/form";
import { removePhoto, replacePhoto } from "@/lib/api/profile";
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
