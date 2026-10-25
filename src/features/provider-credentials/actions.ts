"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { formVersion, selectedImage } from "@/features/media/form";
import { addEvidence, removeEvidence } from "@/lib/api/credentials";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";

async function session() {
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  return { jar, session: incomingSession(jar.getAll(), name), origin: (await headers()).get("origin") };
}

// Every outcome reloads the server-rendered page, so evidence and versions shown are always current.
const back = (locale: string, state: string): never => redirect(`/${locale}/provider/credentials?evidence=${state}#evidence-outcome`);
const text = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };

export async function addCredentialEvidence(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  const file = selectedImage(form.get("evidence"));
  if (version === undefined) return back(locale, "invalid");
  if (typeof file === "string") return back(locale, file);
  const { jar, session: current, origin } = await session();
  const result = await addEvidence(origin, current, cookie => jar.set(cookie), text(form, "credentialId"), version, file);
  back(locale, result.state);
}

export async function removeCredentialEvidence(locale: string, form: FormData) {
  if (!isLocale(locale)) return;
  const version = formVersion(form);
  if (version === undefined) return back(locale, "invalid");
  const { jar, session: current, origin } = await session();
  const result = await removeEvidence(origin, current, cookie => jar.set(cookie), text(form, "credentialId"), version,
    text(form, "mediaId"));
  back(locale, result.state);
}
