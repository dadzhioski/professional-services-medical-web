import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { decideDoctorAction } from "@/features/admin-review/actions";
import { isDoctorDecision, type DoctorDecisionKind } from "@/features/admin-review/outcomes";
import { AdminFrame, adminGate, ReviewFailure } from "@/features/admin-review/page-frame";
import { decisionLinkClass, formatInstant, linkClass, ReviewOutcome } from "@/features/admin-review/review-parts";
import { credentialTypeKey } from "@/features/provider-credentials/labels";
import { approvalKey } from "@/features/provider-onboarding/workspace";
import { publicationKey } from "@/features/provider-profile/fields";
import { DecisionConfirmation } from "@/features/provider-records/decision-confirmation";
import { doctorForReview, submittedCredentials } from "@/lib/api/review";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; organizationId: string }>; searchParams: Promise<{ outcome?: string; decide?: string }> };

const confirmations = {
  approve: { heading: "review.confirm.approve", notes: ["review.confirm.approveNote", "review.separation"], destructive: false },
  reject: { heading: "review.confirm.reject", notes: ["review.confirm.rejectNote"], destructive: true },
  suspend: { heading: "review.confirm.suspend", notes: ["review.confirm.suspendNote"], destructive: true },
  reinstate: { heading: "review.confirm.reinstate", notes: ["review.confirm.reinstateNote"], destructive: false },
} as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // The doctor's identity and application never reach metadata.
  return { title: translator(locale)("review.doctor.heading"), robots: { index: false, follow: false } };
}

export default async function DoctorReviewPage({ params, searchParams }: Props) {
  const { locale, organizationId } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/admin/doctors/${encodeURIComponent(organizationId)}`;
  const gate = await adminGate(locale);
  if (gate.state !== "authenticated") {
    return <ReviewFailure locale={locale} path={path} heading="review.doctor.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const [result, credentials] = await Promise.all([doctorForReview(gate.session, organizationId), submittedCredentials(gate.session)]);
  if (result.state === "notFound") notFound();
  if (result.state !== "ready") {
    return <ReviewFailure locale={locale} path={path} heading="review.doctor.heading" state={result.state} loginHref={gate.loginHref} />;
  }
  const { doctor, profile } = result;
  const query = await searchParams;
  // Controls follow the API-reported state; the API still refuses any transition it does not allow.
  const available: Record<DoctorDecisionKind, boolean> = { approve: doctor.approvalState === "PENDING",
    reject: doctor.approvalState === "PENDING", suspend: !doctor.suspended, reinstate: doctor.suspended };
  const deciding = isDoctorDecision(query.decide) && available[query.decide] ? query.decide : undefined;
  const pending = credentials.state === "ready" ? credentials.credentials.filter(item => item.organizationId === doctor.organizationId) : undefined;
  const decisionLink = (decision: DoctorDecisionKind) => available[decision] &&
    <a className={decisionLinkClass} href={`${path}?decide=${decision}#decision`}>{t(`review.action.${decision}`)}</a>;
  return <AdminFrame locale={locale} path={path} current="doctors">
    <Surface className="space-y-6">
      <Heading>{t("review.doctor.heading")}</Heading>
      <ReviewOutcome locale={locale} value={query.outcome} />
      <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4 [overflow-wrap:anywhere]">
        <dt className="font-semibold">{t("review.displayName")}</dt><dd>{profile?.displayName || t("review.notProvided")}</dd>
        <dt className="font-semibold">{t("review.registered")}</dt><dd>{formatInstant(locale, doctor.registeredAt)}</dd>
        <dt className="font-semibold">{t("workspace.approval")}</dt><dd>{t(approvalKey(doctor.approvalState))}</dd>
        <dt className="font-semibold">{t("review.suspension")}</dt><dd>{t(doctor.suspended ? "review.suspended" : "review.notSuspended")}</dd>
        <dt className="font-semibold">{t("profileEditor.publication")}</dt><dd>{t(publicationKey(profile?.publicationState))}</dd>
      </dl>
      <a className={linkClass} href={`/${locale}/admin/doctors`}>{t("review.back")}</a>
    </Surface>
    {deciding && <DecisionConfirmation id="decision" heading={t(confirmations[deciding].heading)}
      notes={confirmations[deciding].notes.map(note => t(note))} field="revision" value={doctor.revision}
      reason={deciding === "reject" ? { label: t("review.reason"), hint: t("review.reasonHint") } : undefined}
      confirmLabel={t(`review.action.${deciding}`)} pendingLabel={t("review.deciding")} cancelLabel={t("records.cancel")}
      cancelHref={path} action={decideDoctorAction.bind(null, locale, doctor.organizationId, deciding)}
      destructive={confirmations[deciding].destructive} />}
    <Surface>
      <section aria-labelledby="profile-draft" className="space-y-4 [overflow-wrap:anywhere]">
        <h2 id="profile-draft" className="text-xl font-semibold text-teal-950">{t("review.profile")}</h2>
        {profile ? <p className="whitespace-pre-line">{profile.biography || t("review.notProvided")}</p> : <p>{t("review.noProfile")}</p>}
      </section>
    </Surface>
    <Surface>
      <section aria-labelledby="approval-decision" className="space-y-4">
        <h2 id="approval-decision" className="text-xl font-semibold text-teal-950">{t("review.approval")}</h2>
        <p>{t("review.separation")}</p>
        {available.approve ? <p className="flex flex-wrap gap-4">{decisionLink("approve")}{decisionLink("reject")}</p> :
          <p>{t("review.approvalDecided")}</p>}
      </section>
    </Surface>
    <Surface>
      <section aria-labelledby="suspension" className="space-y-4">
        <h2 id="suspension" className="text-xl font-semibold text-teal-950">{t("review.suspension")}</h2>
        <p>{t(doctor.suspended ? "review.confirm.reinstateNote" : "review.confirm.suspendNote")}</p>
        <p className="flex flex-wrap gap-4">{decisionLink("suspend")}{decisionLink("reinstate")}</p>
      </section>
    </Surface>
    <Surface>
      <section aria-labelledby="doctor-credentials" className="space-y-4">
        <h2 id="doctor-credentials" className="text-xl font-semibold text-teal-950">{t("review.doctorCredentials")}</h2>
        {!pending ? <Notice role="alert">{t("account.unavailable")}</Notice> : pending.length ? <ul className="space-y-2">
          {pending.map(credential => <li key={credential.credentialId} className="[overflow-wrap:anywhere]">
            <a className={linkClass} href={`/${locale}/admin/credentials/${encodeURIComponent(credential.credentialId)}`}>
              {credential.title}</a> ({t(credentialTypeKey(credential.type))})</li>)}
        </ul> : <p>{t("review.credentials.none")}</p>}
      </section>
    </Surface>
  </AdminFrame>;
}
