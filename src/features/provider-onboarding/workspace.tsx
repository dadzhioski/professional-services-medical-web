import type { ContextResponse } from "@dadzhioski/professional-services-api-client";
import { Notice } from "@/components/ui/presentation";
import { SubmitButton } from "./submit-button";
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

export type ProviderPage = "workspace" | "onboarding" | "profile" | "services" | "locations" | "credentials" | "publication";

export function ProviderNavigation({ locale, current }: { locale: Locale; current: ProviderPage }) {
  const t = translator(locale);
  const links = [["workspace", `/${locale}/provider`], ["onboarding", `/${locale}/provider/onboarding`],
    ["profile", `/${locale}/provider/profile`], ["services", `/${locale}/provider/services`],
    ["locations", `/${locale}/provider/locations`], ["credentials", `/${locale}/provider/credentials`],
    ["publication", `/${locale}/provider/publication`]] as const;
  return <nav aria-label={t("provider.navigation")}>
    <ul className="flex flex-wrap gap-4">
      {links.map(([key, href]) => <li key={key}><a href={href} aria-current={key === current ? "page" : undefined}
        className="inline-block rounded py-2 text-blue-800 underline underline-offset-4">{t(`provider.${key}`)}</a></li>)}
    </ul>
  </nav>;
}

// The rejection reason is visible to the owner only. Resubmission is offered while rejected and not suspended;
// the API decides at the shown revision and refuses anything else.
export function WorkspaceSummary({ locale, context, resubmit }: { locale: Locale; context: ContextResponse;
  resubmit?: (form: FormData) => Promise<void> }) {
  const t = translator(locale);
  const rejected = context.approvalState === "REJECTED";
  return <section aria-labelledby="workspace-heading" className="space-y-4">
    <h2 id="workspace-heading" className="text-xl font-semibold text-teal-950">{t("workspace.heading")}</h2>
    <p>{t("workspace.ready")}</p>
    <dl className="grid gap-1">
      <dt className="font-semibold">{t("workspace.approval")}</dt>
      <dd>{t(approvalKey(context.approvalState))}</dd>
    </dl>
    {rejected && context.rejectionReason && <div className="space-y-1 rounded-lg border border-slate-400 p-4 [overflow-wrap:anywhere]">
      <h3 className="font-semibold">{t("workspace.feedback")}</h3>
      <p className="whitespace-pre-line">{context.rejectionReason}</p>
    </div>}
    {context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
    {rejected && !context.suspended && resubmit && <form action={resubmit} className="space-y-4">
      <p>{t("workspace.resubmitNote")}</p>
      <input type="hidden" name="revision" value={context.approvalRevision} />
      <SubmitButton label={t("workspace.resubmit")} pendingLabel={t("workspace.resubmitting")} />
    </form>}
  </section>;
}
