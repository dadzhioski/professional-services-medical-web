import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LanguageLinks } from "@/components/site-shell";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { outcomeMessage } from "@/features/media/form";
import { startOnboarding } from "@/features/provider-onboarding/actions";
import { OnboardingChecklist } from "@/features/provider-onboarding/checklist";
import { onboardingProgress } from "@/features/provider-onboarding/progress";
import { ProviderNavigation } from "@/features/provider-onboarding/workspace";
import { resubmitApplication } from "@/features/provider-publication/actions";
import { approvalOutcomes } from "@/features/provider-publication/labels";
import { readCredentials } from "@/lib/api/credentials";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { readProfile, readPublication } from "@/lib/api/profile";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; approval?: string }> };

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
  const { notice, approval } = await searchParams;
  const safeNotice = notice === "forbidden" || notice === "unavailable" || notice === "expired" ? notice : undefined;
  const path = `/${locale}/provider/onboarding`;
  if (account.state !== "authenticated") {
    const loginHref = await googleLoginHref(locale);
    return <><SiteHeader locale={locale} current="workspace" /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
      <LanguageLinks locale={locale} path={path} />
      <Surface className="space-y-6">
        <Heading>{t("onboarding.heading")}</Heading>
        <Notice>{t(`account.${safeNotice ?? account.state}`)}</Notice>
        <a className={linkClass} href={loginHref}>{t("account.login")}</a>
      </Surface>
    </main></>;
  }
  // Progress comes only from the API, read in parallel with the visitor's own session and never cached.
  // Record reads are ignored until the context confirms a workspace.
  const [workspace, publication, profile, credentials] = await Promise.all([currentContext(session), readPublication(session),
    readProfile(session), readCredentials(session)]);
  const ready = workspace.state === "ready";
  const steps = onboardingProgress(ready ? { context: workspace, publication, profile, credentials } : { context: workspace });
  const failedRead = ready ? [publication, profile, credentials].find(read => read.state !== "ready" && read.state !== "missing") : undefined;
  // API failures win over the notice of the last action (workspace creation or sign-out), which wins over the signed-in state.
  const failure = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    failedRead?.state ?? safeNotice;
  const approvalMessage = outcomeMessage(approvalOutcomes, approval);
  return <><SiteHeader locale={locale} current="workspace" /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={path} />
    <ProviderNavigation locale={locale} current="onboarding" />
    <Surface className="space-y-6">
      <Heading>{t("onboarding.heading")}</Heading>
      <p>{t("onboarding.description")}</p>
      <Notice role={failure ? "alert" : undefined}>{t(`account.${failure ?? "authenticated"}`)}</Notice>
      {approvalMessage && <div id="approval-outcome">
        <Notice role={approvalMessage.success ? "status" : "alert"}>{t(approvalMessage.key)}</Notice></div>}
      {ready && workspace.context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
      <OnboardingChecklist locale={locale} steps={steps} context={ready ? workspace.context : undefined}
        create={startOnboarding.bind(null, locale)} resubmit={resubmitApplication.bind(null, locale)} />
    </Surface>
  </main></>;
}
