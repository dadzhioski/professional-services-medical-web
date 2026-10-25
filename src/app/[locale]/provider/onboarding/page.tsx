import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LanguageLinks } from "@/components/site-shell";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { startOnboarding } from "@/features/provider-onboarding/actions";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import { ProviderNavigation, WorkspaceSummary } from "@/features/provider-onboarding/workspace";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> };

const upcomingSteps = ["onboarding.step.profile", "onboarding.step.photo", "onboarding.step.review", "onboarding.step.publication"] as const;
const linkClass = "inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("onboarding.heading"), description: translator(locale)("onboarding.description"),
    robots: { index: false, follow: false } };
}

export default async function OnboardingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  const session = incomingSession((await cookies()).getAll(), name);
  const account = await currentAccount(session);
  const { notice } = await searchParams;
  const safeNotice = notice === "forbidden" || notice === "unavailable" || notice === "expired" ? notice : undefined;
  const path = `/${locale}/provider/onboarding`;
  if (account.state !== "authenticated") {
    const loginHref = await googleLoginHref(locale);
    return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
      <LanguageLinks locale={locale} path={path} />
      <Surface className="space-y-6">
        <Heading>{t("onboarding.heading")}</Heading>
        <Notice>{t(`account.${safeNotice ?? account.state}`)}</Notice>
        <a className={linkClass} href={loginHref}>{t("account.login")}</a>
      </Surface>
    </main></>;
  }
  // Progress comes from the API; a failure notice never overrides an existing workspace.
  const workspace = await currentContext(session);
  const problem = workspace.state === "ready" ? undefined : workspace.state === "notOnboarded" ? safeNotice : workspace.state;
  return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={path} />
    <ProviderNavigation locale={locale} current="onboarding" />
    <Surface className="space-y-6">
      <Heading>{t("onboarding.heading")}</Heading>
      <p>{t("onboarding.description")}</p>
      {problem && <Notice role="alert">{t(`account.${problem}`)}</Notice>}
      <section aria-labelledby="checklist-heading" className="space-y-4">
        <h2 id="checklist-heading" className="text-xl font-semibold text-teal-950">{t("onboarding.checklist")}</h2>
        <ol className="list-decimal space-y-3 pl-6">
          <li>{t("onboarding.step.workspace")}: <strong>{t(workspace.state === "ready" ? "onboarding.done" : "onboarding.todo")}</strong></li>
          {upcomingSteps.map(step => <li key={step}>{t(step)}: <span className="text-slate-700">{t("onboarding.upcoming")}</span></li>)}
        </ol>
      </section>
      {workspace.state === "ready" && <>
        <WorkspaceSummary locale={locale} context={workspace.context} />
        <a className={linkClass} href={`/${locale}/provider`}>{t("onboarding.continue")}</a>
      </>}
      {workspace.state === "notOnboarded" && <form action={startOnboarding.bind(null, locale)} className="space-y-4">
        <p>{t("onboarding.privacy")}</p>
        <SubmitButton label={t("onboarding.create")} pendingLabel={t("onboarding.creating")} />
      </form>}
    </Surface>
  </main></>;
}
