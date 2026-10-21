import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LanguageLinks } from "@/components/site-shell";
import { Button, Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { logout } from "@/features/provider-account/actions";
import { ProviderNavigation, WorkspaceSummary } from "@/features/provider-onboarding/workspace";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> };
const linkClass = "inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("account.heading"), description: translator(locale)("account.description"),
    robots: { index: false, follow: false } };
}

export default async function ProviderPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  const session = incomingSession((await cookies()).getAll(), name);
  const result = await currentAccount(session);
  const workspace = result.state === "authenticated" ? await currentContext(session) : undefined;
  const { notice } = await searchParams;
  // A workspace failure replaces the signed-in notice rather than contradicting it.
  const failed = workspace && workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state : undefined;
  const message = notice === "forbidden" || notice === "unavailable" || notice === "expired" ? notice : failed ?? result.state;
  const loginHref = await googleLoginHref(locale);
  return <><SiteHeader locale={locale} current="workspace" /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={`/${locale}/provider`} />
    {result.state === "authenticated" && <ProviderNavigation locale={locale} current="workspace" />}
    <Surface className="space-y-6">
      <Heading>{t("account.heading")}</Heading>
      <Notice role={message === "authenticated" ? undefined : "alert"}>{t(`account.${message}`)}</Notice>
      {workspace?.state === "ready" && <WorkspaceSummary locale={locale} context={workspace.context} />}
      {workspace?.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={linkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {result.state === "authenticated" ?
        <form action={logout.bind(null, locale)}><Button type="submit">{t("account.logout")}</Button></form> :
        <a className={linkClass} href={loginHref}>{t("account.login")}</a>}
    </Surface>
  </main></>;
}
