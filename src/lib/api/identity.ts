import "server-only";
import { IdentityApi, type CurrentAccount } from "@dadzhioski/professional-services-api-client";
import { isLocale, type Locale } from "@/lib/i18n";
import { isDeletedSession, type SessionCookie } from "./session-cookie";
import { csrfMutation, failure, sessionConfiguration, type IdentityState } from "./session-transport";

export type { IdentityState };
export type AccountResult = { state: "authenticated"; account: CurrentAccount } | { state: IdentityState };

export async function googleLoginHref(locale: Locale): Promise<string> {
  if (!isLocale(locale)) throw new Error("Invalid locale");
  const options = await new IdentityApi().beginGoogleLoginRequestOpts({ returnTo: `/${locale}/provider` });
  if (options.method !== "GET" || !options.path.startsWith("/api/") || /[\\?#\s]/.test(options.path)) throw new Error("Invalid login navigation");
  return `${options.path}?${new URLSearchParams(options.query as Record<string, string>)}`;
}

export async function currentAccount(session?: string): Promise<AccountResult> {
  if (!session) return { state: "signedOut" };
  const api = new IdentityApi(sessionConfiguration(session));
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
  let deleted = false;
  const result = await csrfMutation(origin, session, cookie => {
    deleted = isDeletedSession(cookie);
    apply(cookie);
  }, async (configuration, token) => {
    deleted = false;
    return (await new IdentityApi(configuration).logoutRaw({ xCSRFTOKEN: token })).raw.status;
  });
  if (!result.ok) return result.state;
  return result.value === 204 && deleted ? "signedOut" : "unavailable";
}
