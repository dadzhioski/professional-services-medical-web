import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LanguageLinks } from "@/components/site-shell";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { evidenceOutcomes, outcomeMessage } from "@/features/media/form";
import { EvidenceList } from "@/features/provider-credentials/evidence-list";
import { ProviderNavigation } from "@/features/provider-onboarding/workspace";
import { readCredentials } from "@/lib/api/credentials";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ evidence?: string }> };
const linkClass = "inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Evidence is private: nothing about it reaches metadata, and the page is never indexed.
  return { title: translator(locale)("evidence.heading"), robots: { index: false, follow: false } };
}

export default async function CredentialsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  const session = incomingSession((await cookies()).getAll(), name);
  const account = await currentAccount(session);
  const path = `/${locale}/provider/credentials`;
  if (account.state !== "authenticated") {
    const loginHref = await googleLoginHref(locale);
    return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
      <LanguageLinks locale={locale} path={path} />
      <Surface className="space-y-6">
        <Heading>{t("evidence.heading")}</Heading>
        <Notice>{t(`account.${account.state}`)}</Notice>
        <a className={linkClass} href={loginHref}>{t("account.login")}</a>
      </Surface>
    </main></>;
  }
  // Credentials require a workspace, so they are only read once the API confirms one exists.
  const workspace = await currentContext(session);
  const credentials = workspace.state === "ready" ? await readCredentials(session) : undefined;
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    credentials && credentials.state !== "ready" ? credentials.state : undefined;
  const message = outcomeMessage(evidenceOutcomes, (await searchParams).evidence);
  return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={path} />
    <ProviderNavigation locale={locale} current="credentials" />
    <Surface className="space-y-6">
      <Heading>{t("evidence.heading")}</Heading>
      <p>{t("evidence.description")}</p>
      <p>{t("evidence.privacy")}</p>
      <p>{t("evidence.revision")}</p>
      {message && <div id="evidence-outcome"><Notice role={message.success ? "status" : "alert"}>{t(message.key)}</Notice></div>}
      {failed && <Notice role="alert">{t(`account.${failed}`)}</Notice>}
      {workspace.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={linkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {workspace.state === "ready" && workspace.context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
      {credentials?.state === "ready" && <EvidenceList locale={locale} credentials={credentials.credentials} />}
    </Surface>
  </main></>;
}
