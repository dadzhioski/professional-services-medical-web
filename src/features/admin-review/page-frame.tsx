import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { LanguageLinks } from "@/components/site-shell";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { SignedOutView } from "@/features/provider-records/page-frame";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import type { IdentityState } from "@/lib/api/session-transport";
import { getServerEnvironment } from "@/lib/config/server";
import { translator, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";

export type AdminPage = "doctors" | "credentials";

// Only the account is checked here. Administrator access is never inferred by the web: the review API's own
// grant check answers it, and an administrator need not have a doctor workspace.
export async function adminGate(locale: Locale) {
  const session = incomingSession((await cookies()).getAll(), sessionCookieName(getServerEnvironment().publicOrigin));
  const account = await currentAccount(session);
  // Sign-in returns to the provider account page, the only return path the API accepts for this web.
  const loginHref = await googleLoginHref(locale);
  if (account.state !== "authenticated") return { state: account.state, loginHref } as const;
  return { state: "authenticated", session, loginHref } as const;
}

export function AdminNavigation({ locale, current }: { locale: Locale; current: AdminPage }) {
  const t = translator(locale);
  const links = [["doctors", `/${locale}/admin/doctors`], ["credentials", `/${locale}/admin/credentials`]] as const;
  return <nav aria-label={t("admin.navigation")}>
    <ul className="flex flex-wrap gap-4">
      {links.map(([key, href]) => <li key={key}><a href={href} aria-current={key === current ? "page" : undefined}
        className="inline-block rounded py-2 text-blue-800 underline underline-offset-4">{t(`admin.${key}`)}</a></li>)}
    </ul>
  </nav>;
}

export function AdminFrame({ locale, path, current, children }: { locale: Locale; path: string; current?: AdminPage; children: ReactNode }) {
  return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={path} />
    {current && <AdminNavigation locale={locale} current={current} />}
    {children}
  </main></>;
}

// A review API failure replaces the whole page; nothing read before it is shown alongside.
export function ReviewFailure({ locale, path, heading, state, loginHref }: {
  locale: Locale; path: string; heading: TranslationKey; state: IdentityState; loginHref: string;
}) {
  const t = translator(locale);
  if (state === "signedOut" || state === "expired") {
    return <SignedOutView locale={locale} path={path} heading={heading} state={state} loginHref={loginHref} />;
  }
  return <AdminFrame locale={locale} path={path}>
    <Surface className="space-y-6">
      <Heading>{t(heading)}</Heading>
      <Notice role="alert">{t(state === "forbidden" ? "admin.denied" : "account.unavailable")}</Notice>
    </Surface>
  </AdminFrame>;
}
