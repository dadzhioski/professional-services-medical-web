import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { AdminFrame, adminGate, ReviewFailure } from "@/features/admin-review/page-frame";
import { formatInstant, linkClass } from "@/features/admin-review/review-parts";
import { approvalKey } from "@/features/provider-onboarding/workspace";
import { approvalStates, doctorsForReview, type ApprovalState } from "@/lib/api/review";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ state?: string }> };
const filterKeys = { PENDING: "review.filter.pending", APPROVED: "review.filter.approved", REJECTED: "review.filter.rejected" } as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Review data is private to administrators: nothing about it reaches metadata, and the page is never indexed.
  return { title: translator(locale)("review.doctors.heading"), robots: { index: false, follow: false } };
}

export default async function DoctorsReviewPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/admin/doctors`;
  const gate = await adminGate(locale);
  if (gate.state !== "authenticated") {
    return <ReviewFailure locale={locale} path={path} heading="review.doctors.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const { state: requested } = await searchParams;
  const filter: ApprovalState = approvalStates.find(state => state === requested) ?? "PENDING";
  const result = await doctorsForReview(gate.session, filter);
  if (result.state !== "ready") {
    return <ReviewFailure locale={locale} path={path} heading="review.doctors.heading" state={result.state} loginHref={gate.loginHref} />;
  }
  return <AdminFrame locale={locale} path={path} current="doctors">
    <Surface className="space-y-6">
      <Heading>{t("review.doctors.heading")}</Heading>
      <p>{t("review.doctors.description")}</p>
      <p>{t("review.separation")}</p>
      <nav aria-label={t("review.filter")}>
        <ul className="flex flex-wrap gap-4">
          {approvalStates.map(state => <li key={state}><a className={linkClass} href={`${path}?state=${state}`}
            aria-current={state === filter ? "page" : undefined}>{t(filterKeys[state])}</a></li>)}
        </ul>
      </nav>
    </Surface>
    <Surface>
      <section aria-labelledby="doctor-list" className="space-y-4">
        <h2 id="doctor-list" className="text-xl font-semibold text-teal-950">{t(filterKeys[filter])}</h2>
        <p className="text-sm text-slate-700">{t("review.listLimit")}</p>
        {result.doctors.length ? <ul className="space-y-4">
          {result.doctors.map(doctor => {
            const registered = formatInstant(locale, doctor.registeredAt);
            return <li key={doctor.organizationId} className="space-y-2 rounded-xl border border-slate-300 bg-white p-4">
              <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                <dt className="font-semibold">{t("review.registered")}</dt><dd>{registered}</dd>
                <dt className="font-semibold">{t("workspace.approval")}</dt><dd>{t(approvalKey(doctor.approvalState))}</dd>
                <dt className="font-semibold">{t("review.suspension")}</dt>
                <dd>{t(doctor.suspended ? "review.suspended" : "review.notSuspended")}</dd>
              </dl>
              <a className={linkClass} href={`${path}/${encodeURIComponent(doctor.organizationId)}`}>
                {t("review.open")}<span className="sr-only">: {t("review.registered")} {registered}</span></a>
            </li>;
          })}
        </ul> : <p>{t("review.doctors.none")}</p>}
      </section>
    </Surface>
  </AdminFrame>;
}
