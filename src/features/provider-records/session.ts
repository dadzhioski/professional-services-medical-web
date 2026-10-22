import "server-only";
import { cookies, headers } from "next/headers";
import { incomingSession, sessionCookieName, type SessionCookie } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";

// The session cookie and the request Origin used by every provider mutation; the jar receives rotations.
export async function actionSession() {
  const jar = await cookies();
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  return { session: incomingSession(jar.getAll(), name), origin: (await headers()).get("origin"),
    apply: (cookie: SessionCookie) => { jar.set(cookie); } };
}
