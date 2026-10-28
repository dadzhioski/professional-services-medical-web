import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { ChecklistLink, ProviderNavigation, type ProviderPage } from "@/features/provider-onboarding/workspace";
import { publicationKey } from "@/features/provider-profile/fields";
import { noticeKey, type RecordNotice } from "./form";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { currentContext } from "@/lib/api/organization";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { translator, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";

export const actionLinkClass = "inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900";

// Account first, then workspace: record APIs are only called once the API confirms a workspace exists.
export async function providerGate(locale: Locale) {
  const session = incomingSession((await cookies()).getAll(), sessionCookieName(getServerEnvironment().publicOrigin));
  const account = await currentAccount(session);
  const loginHref = await googleLoginHref(locale);
  if (account.state !== "authenticated") return { state: account.state, loginHref } as const;
  return { state: "authenticated", session, loginHref, workspace: await currentContext(session) } as const;
}

export function ProviderFrame({ locale, path, current, children }: {
  locale: Locale; path: string; current?: ProviderPage; children: ReactNode;
}) {
  return <><SiteHeader locale={locale} path={path} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    {current && <ProviderNavigation locale={locale} current={current} />}
    {children}
  </main></>;
}

export function RecordNoticeView({ locale, notice }: { locale: Locale; notice?: RecordNotice }) {
  if (!notice) return null;
  const success = notice === "saved" || notice === "removed";
  return <Notice role={success ? "status" : "alert"}>{translator(locale)(noticeKey(notice))}
    {success && <> <ChecklistLink locale={locale} /></>}</Notice>;
}

// Shows the publication state the API reports after each change; eligibility is never computed here.
export function PublicationStatus({ locale, state }: { locale: Locale; state: string | undefined }) {
  const t = translator(locale);
  return <div className="space-y-2">
    <dl className="grid gap-1">
      <dt className="font-semibold">{t("profileEditor.publication")}</dt>
      <dd>{t(publicationKey(state))}</dd>
    </dl>
    <p className="text-sm text-slate-700">{t("records.publicationNote")}</p>
  </div>;
}

export function SignedOutView({ locale, path, heading, state, loginHref }: {
  locale: Locale; path: string; heading: TranslationKey; state: "signedOut" | "expired" | "forbidden" | "unavailable"; loginHref: string;
}) {
  const t = translator(locale);
  return <ProviderFrame locale={locale} path={path}>
    <Surface className="space-y-6">
      <Heading>{t(heading)}</Heading>
      <Notice>{t(`account.${state}`)}</Notice>
      <a className={actionLinkClass} href={loginHref}>{t("account.login")}</a>
    </Surface>
  </ProviderFrame>;
}
