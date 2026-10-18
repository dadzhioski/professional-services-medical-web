"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { logoutSession } from "@/lib/api/identity";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";

export async function logout(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  const state = await logoutSession((await headers()).get("origin"), incomingSession(jar.getAll(), name), cookie => jar.set(cookie));
  redirect(`/${locale}/provider${state === "signedOut" ? "" : `?notice=${state}`}`);
}
