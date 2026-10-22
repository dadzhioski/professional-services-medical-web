import type { ContextResponse } from "@dadzhioski/professional-services-api-client";
import { Notice } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";

const approvalKeys = {
  PENDING: "workspace.approval.pending",
  APPROVED: "workspace.approval.approved",
  REJECTED: "workspace.approval.rejected",
} as const;

// Present API-provided states only; unknown values never imply any permission.
export function approvalKey(state: string) {
  return Object.hasOwn(approvalKeys, state) ? approvalKeys[state as keyof typeof approvalKeys] : "workspace.approval.unknown";
}

export type ProviderPage = "workspace" | "onboarding" | "profile" | "services" | "locations";

export function ProviderNavigation({ locale, current }: { locale: Locale; current: ProviderPage }) {
  const t = translator(locale);
  const links = [["workspace", `/${locale}/provider`], ["onboarding", `/${locale}/provider/onboarding`],
    ["profile", `/${locale}/provider/profile`], ["services", `/${locale}/provider/services`],
    ["locations", `/${locale}/provider/locations`]] as const;
  return <nav aria-label={t("provider.navigation")}>
    <ul className="flex flex-wrap gap-4">
      {links.map(([key, href]) => <li key={key}><a href={href} aria-current={key === current ? "page" : undefined}
        className="inline-block rounded py-2 text-blue-800 underline underline-offset-4">{t(`provider.${key}`)}</a></li>)}
    </ul>
  </nav>;
}

export function WorkspaceSummary({ locale, context }: { locale: Locale; context: ContextResponse }) {
  const t = translator(locale);
  return <section aria-labelledby="workspace-heading" className="space-y-4">
    <h2 id="workspace-heading" className="text-xl font-semibold text-teal-950">{t("workspace.heading")}</h2>
    <p>{t("workspace.ready")}</p>
    <dl className="grid gap-1">
      <dt className="font-semibold">{t("workspace.approval")}</dt>
      <dd>{t(approvalKey(context.approvalState))}</dd>
    </dl>
    {context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
  </section>;
}
