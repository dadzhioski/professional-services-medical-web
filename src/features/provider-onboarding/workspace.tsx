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

export type ProviderPage = "onboarding" | "profile" | "services" | "locations" | "credentials" | "publication";

export const checklistPath = (locale: Locale) => `/${locale}/provider/onboarding`;

export function ProviderNavigation({ locale, current }: { locale: Locale; current: ProviderPage }) {
  const t = translator(locale);
  const links = [["onboarding", checklistPath(locale)],
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

// Success notices lead back to the checklist, which rereads progress from the API (decision 3).
export function ChecklistLink({ locale }: { locale: Locale }) {
  return <a href={checklistPath(locale)} className="font-semibold text-blue-800 underline underline-offset-4">
    {translator(locale)("onboarding.backToChecklist")}</a>;
}
