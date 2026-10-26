import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { outcomeMessage } from "@/features/media/form";
import { approvalKey } from "@/features/provider-onboarding/workspace";
import { publicationKey } from "@/features/provider-profile/fields";
import { changePublicationAction } from "@/features/provider-publication/actions";
import { missingPart, publicationOutcomes } from "@/features/provider-publication/labels";
import { DecisionConfirmation } from "@/features/provider-records/decision-confirmation";
import { actionLinkClass, ProviderFrame, providerGate, SignedOutView } from "@/features/provider-records/page-frame";
import { readPublication } from "@/lib/api/profile";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ outcome?: string; confirm?: string }> };
const linkClass = "inline-block py-2 font-semibold text-blue-800 underline underline-offset-4";
const decisionLinkClass = "inline-block min-h-11 rounded-lg border-2 border-teal-800 px-5 py-3 font-semibold text-teal-950 underline hover:bg-teal-50";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("publication.heading"), robots: { index: false, follow: false } };
}

export default async function PublicationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/provider/publication`;
  const gate = await providerGate(locale);
  if (gate.state !== "authenticated") {
    return <SignedOutView locale={locale} path={path} heading="publication.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const { session, workspace } = gate;
  const result = workspace.state === "ready" ? await readPublication(session) : undefined;
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    result && result.state !== "ready" && result.state !== "missing" ? result.state : undefined;
  const publication = result?.state === "ready" ? result.publication : undefined;
  const query = await searchParams;
  const message = outcomeMessage(publicationOutcomes, query.outcome);
  // Eligibility is what the API reports; the API still refuses a publication it does not allow.
  const published = publication?.publicationState === "PUBLISHED";
  const eligible = !!publication && publication.approved && !publication.suspended && !publication.missing.length && !published;
  const confirming = query.confirm === "publish" && eligible ? "publish" : query.confirm === "unpublish" && published ? "unpublish" : undefined;
  return <ProviderFrame locale={locale} path={path} current="publication">
    <Surface className="space-y-6">
      <Heading>{t("publication.heading")}</Heading>
      <p>{t("publication.description")}</p>
      {message && <div id="publication-outcome">
        <Notice role={message.success ? "status" : "alert"}>{t(message.key)}</Notice></div>}
      {failed && <Notice role="alert">{t(`account.${failed}`)}</Notice>}
      {workspace.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={actionLinkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {result?.state === "missing" && <div className="space-y-4">
        <p>{t("publication.noProfile")}</p>
        <a className={actionLinkClass} href={`/${locale}/provider/profile`}>{t("provider.profile")}</a>
      </div>}
      {publication && <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="font-semibold">{t("profileEditor.publication")}</dt><dd>{t(publicationKey(publication.publicationState))}</dd>
        <dt className="font-semibold">{t("workspace.approval")}</dt>
        <dd>{t(approvalKey(workspace.state === "ready" ? workspace.context.approvalState : ""))}</dd>
      </dl>}
      {publication?.suspended && <Notice>{t("publication.suspended")}</Notice>}
    </Surface>
    {confirming && publication && <DecisionConfirmation id="publication-confirm" heading={t(`publication.confirm.${confirming}`)}
      notes={[t(`publication.confirm.${confirming}Note`)]} field="version" value={publication.version}
      confirmLabel={t(`publication.${confirming}`)} pendingLabel={t("publication.changing")} cancelLabel={t("records.cancel")}
      cancelHref={path} action={changePublicationAction.bind(null, locale, confirming)} destructive={confirming === "unpublish"} />}
    {publication && <Surface>
      <section aria-labelledby="publication-readiness" className="space-y-4">
        <h2 id="publication-readiness" className="text-xl font-semibold text-teal-950">{t("publication.readiness")}</h2>
        {!publication.approved && <p>{t("publication.needsApproval")}</p>}
        {publication.missing.length ? <>
          <p>{t("publication.missingIntro")}</p>
          <ul className="list-disc space-y-2 pl-6">
            {publication.missing.map(part => {
              const { key, page } = missingPart(part);
              return <li key={part}>{page ? <a className={linkClass} href={`/${locale}/provider/${page}`}>{t(key)}</a> : t(key)}</li>;
            })}
          </ul>
        </> : <p>{t("publication.complete")}</p>}
        {eligible && <a className={decisionLinkClass} href={`${path}?confirm=publish#publication-confirm`}>{t("publication.publish")}</a>}
        {published && <>
          <p>{t("publication.liveNote")}</p>
          <a className={decisionLinkClass} href={`${path}?confirm=unpublish#publication-confirm`}>{t("publication.unpublish")}</a>
        </>}
        {publication.publicationState === "UNPUBLISHED" && <p>{t("publication.republishNote")}</p>}
      </section>
    </Surface>}
  </ProviderFrame>;
}
