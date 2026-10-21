"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { onboardWorkspace } from "@/lib/api/organization";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale } from "@/lib/i18n";

// Submitted form fields are ignored: the workspace is derived from the session by the API.
export async function startOnboarding(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  const state = await onboardWorkspace((await headers()).get("origin"), incomingSession(jar.getAll(), name), cookie => jar.set(cookie));
  redirect(state === "ready" ? `/${locale}/provider` : `/${locale}/provider/onboarding?notice=${state}`);
}
