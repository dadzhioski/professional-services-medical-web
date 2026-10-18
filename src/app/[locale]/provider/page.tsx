import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LanguageLinks } from "@/components/site-shell";
import { Button, Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { logout } from "@/features/provider-account/actions";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> };

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
  const result = await currentAccount(incomingSession((await cookies()).getAll(), name));
  const { notice } = await searchParams;
  const message = notice === "forbidden" || notice === "unavailable" || notice === "expired" ? notice : result.state;
  const loginHref = await googleLoginHref(locale);
  return <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={`/${locale}/provider`} />
    <Surface className="space-y-6">
      <Heading>{t("account.heading")}</Heading>
      <Notice>{t(`account.${message}`)}</Notice>
      {result.state === "authenticated" ?
        <form action={logout.bind(null, locale)}><Button type="submit">{t("account.logout")}</Button></form> :
        <a className="inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900"
          href={loginHref}>{t("account.login")}</a>}
    </Surface>
  </main>;
}
