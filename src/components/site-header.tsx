import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/presentation";
import { LanguageLinks } from "@/components/site-shell";
import { logout } from "@/features/provider-account/actions";
import { currentAccount } from "@/lib/api/identity";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { translator, type Locale } from "@/lib/i18n";

const linkClass = "inline-flex min-h-11 items-center rounded py-2 font-semibold text-blue-800 underline underline-offset-4";
const signInClass = "inline-flex min-h-11 items-center rounded-lg bg-teal-800 px-5 py-2 font-semibold text-white hover:bg-teal-900";

// Only the authenticated state is shown; any identity failure falls back to the signed-out entry.
async function signedIn(): Promise<boolean> {
  try {
    const name = sessionCookieName(getServerEnvironment().publicOrigin);
    return (await currentAccount(incomingSession((await cookies()).getAll(), name))).state === "authenticated";
  } catch (error) {
    // Never swallow Next.js dynamic-rendering signals into a static signed-out header.
    unstable_rethrow(error);
    return false;
  }
}

// Shares the max-w-3xl column with main and the footer so their left edges line up (WEB-M1-018).
// Without a path (the not-found page) there is no page to switch language on, so no language links.
export async function SiteHeader({ locale, path, current }: { locale: Locale; path?: string; current?: "directory" | "workspace" }) {
  const t = translator(locale);
  const authenticated = await signedIn();
  const provider = `/${locale}/provider`;
  return <header className="mx-auto w-full max-w-3xl px-6 pb-6 pt-2">
    {path && <LanguageLinks locale={locale} path={path} />}
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <a href={`/${locale}/doctors`} aria-current={current === "directory" ? "page" : undefined}
        className="inline-flex min-h-11 items-center rounded text-lg font-semibold text-teal-900">{t("app.title")}</a>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <nav aria-label={t("navigation.primary")}>
          <ul className="flex flex-wrap gap-4">
            <li><a href={provider} aria-current={current === "workspace" ? "page" : undefined} className={linkClass}>
              {t(authenticated ? "navigation.workspace" : "navigation.doctors")}</a></li>
          </ul>
        </nav>
        {authenticated
          ? <form action={logout.bind(null, locale)}><Button type="submit">{t("account.logout")}</Button></form>
          : <a href={provider} className={signInClass}>{t("account.signIn")}</a>}
      </div>
    </div>
  </header>;
}
