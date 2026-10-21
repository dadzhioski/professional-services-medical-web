import "server-only";
import { Configuration, IdentityApi, ResponseError, type InitOverrideFunction } from "@dadzhioski/professional-services-api-client";
import { getServerEnvironment } from "@/lib/config/server";
import { incomingSession, isDeletedSession, sessionChanges, sessionCookieName, type SessionCookie } from "./session-cookie";

export type IdentityState = "signedOut" | "expired" | "forbidden" | "unavailable";
export type ApplySession = (cookie: SessionCookie) => void;
export type MutationResult<T> = { ok: true; value: T } | { ok: false; state: IdentityState };

export function failure(error: unknown, session?: string): IdentityState {
  if (error instanceof ResponseError) {
    if (error.response.status === 401) return session ? "expired" : "signedOut";
    if (error.response.status === 403) return "forbidden";
  }
  return "unavailable";
}

export function sessionConfiguration(session: string | undefined, apply?: ApplySession): Configuration {
  const { apiInternalUrl, publicOrigin } = getServerEnvironment();
  const name = sessionCookieName(publicOrigin);
  let current = incomingSession(session ? [{ name, value: session }] : [], name);
  if (session && !current) throw new Error("Invalid session input");
  return new Configuration({
    basePath: apiInternalUrl,
    fetchApi: async (url, init) => {
      // A new header set per request retains the generated CSRF header only.
      const headers = new Headers();
      const csrf = new Headers(init?.headers).get("X-CSRF-TOKEN");
      if (csrf) headers.set("X-CSRF-TOKEN", csrf);
      if (current) headers.set("Cookie", `${name}=${current}`);
      const response = await fetch(url, { ...init, headers, cache: "no-store", credentials: "omit",
        redirect: "error", signal: AbortSignal.timeout(5_000) });
      const changes = sessionChanges(response.headers, name);
      if (apply) {
        for (const cookie of changes) {
          apply(cookie);
          current = isDeletedSession(cookie) ? undefined : cookie.value;
        }
      } else if (changes.length && response.ok) {
        // Read-only SSR cannot rotate/create sessions. Unexpected API behavior fails closed.
        throw new Error("Unexpected session change");
      }
      return response;
    },
  });
}

// The contract documents the token header for mutations but not on each generated operation.
export function csrfHeader(token: string): InitOverrideFunction {
  return async ({ init }) => ({ headers: { ...init.headers, "X-CSRF-TOKEN": token } });
}

export async function csrfMutation<T>(origin: string | null, session: string | undefined, apply: ApplySession,
  mutate: (configuration: Configuration, token: string, session: string) => Promise<T>): Promise<MutationResult<T>> {
  const { publicOrigin } = getServerEnvironment();
  // Do not bootstrap CSRF until the web entry point has passed origin validation.
  if (origin !== publicOrigin) return { ok: false, state: "forbidden" };
  if (!session) return { ok: false, state: "signedOut" };
  try {
    const configuration = sessionConfiguration(session, apply);
    const csrf = await (await new IdentityApi(configuration).getCsrfTokenRaw()).value();
    if (!csrf || csrf.headerName !== "X-CSRF-TOKEN" || typeof csrf.token !== "string" ||
        !csrf.token || csrf.token.length > 4096 || /[\s\x00-\x1f\x7f]/.test(csrf.token)) return { ok: false, state: "unavailable" };
    // Tokens are request-local and discarded; the next mutation always bootstraps afresh.
    return { ok: true, value: await mutate(configuration, csrf.token, session) };
  } catch (error) { return { ok: false, state: failure(error, session) }; }
}
