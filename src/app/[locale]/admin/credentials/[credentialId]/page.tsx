import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { OwnerImage } from "@/features/media/owner-image";
import { decideCredentialAction } from "@/features/admin-review/actions";
import { isCredentialDecision, type CredentialDecisionKind } from "@/features/admin-review/outcomes";
import { AdminFrame, adminGate, ReviewFailure } from "@/features/admin-review/page-frame";
import { decisionLinkClass, formatDate, formatInstant, linkClass, ReviewOutcome } from "@/features/admin-review/review-parts";
import { credentialStateKey, credentialTypeKey } from "@/features/provider-credentials/labels";
import { DecisionConfirmation } from "@/features/provider-records/decision-confirmation";
import { adminMediaContentPath } from "@/lib/api/media";
import { credentialForReview } from "@/lib/api/review";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; credentialId: string }>; searchParams: Promise<{ outcome?: string; decide?: string }> };

const confirmations = {
  approve: { heading: "review.confirm.approveCredential", notes: ["review.confirm.approveCredentialNote", "review.separation"],
    destructive: false },
  reject: { heading: "review.confirm.rejectCredential", notes: ["review.confirm.rejectNote"], destructive: true },
} as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Credential details and evidence never reach metadata.
  return { title: translator(locale)("review.credential.heading"), robots: { index: false, follow: false } };
}

export default async function CredentialReviewPage({ params, searchParams }: Props) {
  const { locale, credentialId } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/admin/credentials/${encodeURIComponent(credentialId)}`;
  const gate = await adminGate(locale);
  if (gate.state !== "authenticated") {
    return <ReviewFailure locale={locale} path={path} heading="review.credential.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const result = await credentialForReview(gate.session, credentialId);
  if (result.state === "notFound") notFound();
  if (result.state !== "ready") {
    return <ReviewFailure locale={locale} path={path} heading="review.credential.heading" state={result.state} loginHref={gate.loginHref} />;
  }
  const { credential } = result;
  const query = await searchParams;
  // Only a submitted revision can be decided; the API refuses anything else, including a revision changed since.
  const decidable = credential.state === "SUBMITTED";
  const deciding = decidable && isCredentialDecision(query.decide) ? query.decide : undefined;
  const images = credential.evidenceMediaIds.flatMap(mediaId => {
    const contentPath = adminMediaContentPath(mediaId);
    return contentPath ? [{ mediaId, path: contentPath }] : [];
  });
  const decisionLink = (decision: CredentialDecisionKind) =>
    <a className={decisionLinkClass} href={`${path}?decide=${decision}#decision`}>{t(`review.action.${decision}`)}</a>;
  return <AdminFrame locale={locale} path={path} current="credentials">
    <Surface className="space-y-6 [overflow-wrap:anywhere]">
      <Heading>{t("review.credential.heading")}</Heading>
      <ReviewOutcome locale={locale} value={query.outcome} />
      <h2 className="text-xl font-semibold text-teal-950">{credential.title}</h2>
      <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="font-semibold">{t("credential.type")}</dt><dd>{t(credentialTypeKey(credential.type))}</dd>
        <dt className="font-semibold">{t("credential.issuer")}</dt><dd>{credential.issuer}</dd>
        <dt className="font-semibold">{t("credentials.issued")}</dt><dd>{formatDate(locale, credential.issuedOn)}</dd>
        <dt className="font-semibold">{t("credentials.expires")}</dt>
        <dd>{credential.expiresOn ? formatDate(locale, credential.expiresOn) : t("credentials.noExpiry")}</dd>
        <dt className="font-semibold">{t("credential.state")}</dt><dd>{t(credentialStateKey(credential.state))}</dd>
        {credential.submittedAt && <><dt className="font-semibold">{t("review.submitted")}</dt>
          <dd>{formatInstant(locale, credential.submittedAt)}</dd></>}
      </dl>
      <p className="flex flex-wrap gap-4">
        <a className={linkClass} href={`/${locale}/admin/credentials`}>{t("review.backCredentials")}</a>
        <a className={linkClass} href={`/${locale}/admin/doctors/${encodeURIComponent(credential.organizationId)}`}>{t("review.openDoctor")}</a>
      </p>
    </Surface>
    {deciding && <DecisionConfirmation id="decision" heading={t(confirmations[deciding].heading)}
      notes={confirmations[deciding].notes.map(note => t(note))} field="revision" value={credential.revision}
      reason={deciding === "reject" ? { label: t("review.reason"), hint: t("review.reasonHint") } : undefined}
      confirmLabel={t(`review.action.${deciding}`)} pendingLabel={t("review.deciding")} cancelLabel={t("records.cancel")}
      cancelHref={path} action={decideCredentialAction.bind(null, locale, credential.credentialId, deciding)}
      destructive={confirmations[deciding].destructive} />}
    <Surface>
      <section aria-labelledby="evidence" className="space-y-4">
        <h2 id="evidence" className="text-xl font-semibold text-teal-950">{t("credentials.evidence")}</h2>
        <p>{t("review.evidencePrivacy")}</p>
        {images.length ? <ul className="flex flex-wrap gap-4">
          {images.map(({ mediaId, path: contentPath }, index) => <li key={mediaId} className="w-full max-w-md">
            <OwnerImage path={contentPath} alt={`${t("evidence.image")} ${index + 1}`} className="rounded-lg border border-slate-300" />
          </li>)}
        </ul> : <p>{t("evidence.noEvidence")}</p>}
      </section>
    </Surface>
    <Surface>
      <section aria-labelledby="credential-decision" className="space-y-4">
        <h2 id="credential-decision" className="text-xl font-semibold text-teal-950">{t("review.credentialDecision")}</h2>
        {decidable ? <p className="flex flex-wrap gap-4">{decisionLink("approve")}{decisionLink("reject")}</p> :
          <p>{t("review.credentialDecided")}</p>}
      </section>
    </Surface>
  </AdminFrame>;
}
