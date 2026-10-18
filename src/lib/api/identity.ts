import "server-only";
import { Configuration, IdentityApi, ResponseError, type CurrentAccount } from "@dadzhioski/professional-services-api-client";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, type Locale } from "@/lib/i18n";
import { incomingSession, isDeletedSession, sessionChanges, sessionCookieName, type SessionCookie } from "./session-cookie";

export type IdentityState = "signedOut" | "expired" | "forbidden" | "unavailable";
export type AccountResult = { state: "authenticated"; account: CurrentAccount } | { state: IdentityState };

export async function googleLoginHref(locale: Locale): Promise<string> {
  if (!isLocale(locale)) throw new Error("Invalid locale");
  const options = await new IdentityApi().beginGoogleLoginRequestOpts({ returnTo: `/${locale}/provider` });
  if (options.method !== "GET" || !options.path.startsWith("/api/") || /[\\?#\s]/.test(options.path)) throw new Error("Invalid login navigation");
  return `${options.path}?${new URLSearchParams(options.query as Record<string, string>)}`;
}

function failure(error: unknown, session?: string): IdentityState {
  if (error instanceof ResponseError) {
    if (error.response.status === 401) return session ? "expired" : "signedOut";
    if (error.response.status === 403) return "forbidden";
  }
  return "unavailable";
}

function client(session: string | undefined, apply?: (cookie: SessionCookie) => void) {
  const { apiInternalUrl, publicOrigin } = getServerEnvironment();
  const name = sessionCookieName(publicOrigin);
  let current = incomingSession(session ? [{ name, value: session }] : [], name);
  if (session && !current) throw new Error("Invalid session input");
  return new IdentityApi(new Configuration({
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
  }));
}

export async function currentAccount(session?: string): Promise<AccountResult> {
  if (!session) return { state: "signedOut" };
  const api = client(session);
  try {
    const account = await api.getCurrentAccount();
    if (!account || typeof account.accountId !== "string" || !account.accountId ||
        typeof account.emailVerified !== "boolean" || !(account.sessionExpiresAt instanceof Date) ||
        !Number.isFinite(account.sessionExpiresAt.getTime())) return { state: "unavailable" };
    if (!account.emailVerified) return { state: "forbidden" };
    if (account.sessionExpiresAt.getTime() <= Date.now()) return { state: "expired" };
    return { state: "authenticated", account };
  } catch (error) { return { state: failure(error, session) }; }
}

export async function logoutSession(origin: string | null, session: string | undefined,
  apply: (cookie: SessionCookie) => void): Promise<IdentityState> {
  const { publicOrigin } = getServerEnvironment();
  // Do not bootstrap CSRF until the web entry point has passed origin validation.
  if (origin !== publicOrigin) return "forbidden";
  if (!session) return "signedOut";
  let deleted = false;
  const api = client(session, cookie => {
    deleted = isDeletedSession(cookie);
    apply(cookie);
  });
  try {
    const csrf = await (await api.getCsrfTokenRaw()).value();
    if (!csrf || csrf.headerName !== "X-CSRF-TOKEN" || typeof csrf.token !== "string" ||
        !csrf.token || csrf.token.length > 4096 || /[\s\x00-\x1f\x7f]/.test(csrf.token)) return "unavailable";
    deleted = false;
    const result = await api.logoutRaw({ xCSRFTOKEN: csrf.token });
    if (result.raw.status !== 204 || !deleted) return "unavailable";
    // Tokens are request-local and discarded; the next mutation always bootstraps afresh.
    return "signedOut";
  } catch (error) { return failure(error, session); }
}
