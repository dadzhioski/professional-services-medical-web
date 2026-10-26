import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { AdminFrame, adminGate, ReviewFailure } from "@/features/admin-review/page-frame";
import { formatInstant, linkClass } from "@/features/admin-review/review-parts";
import { credentialTypeKey } from "@/features/provider-credentials/labels";
import { submittedCredentials } from "@/lib/api/review";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("review.credentials.heading"), robots: { index: false, follow: false } };
}

export default async function CredentialsReviewPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/admin/credentials`;
  const gate = await adminGate(locale);
  if (gate.state !== "authenticated") {
    return <ReviewFailure locale={locale} path={path} heading="review.credentials.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const result = await submittedCredentials(gate.session);
  if (result.state !== "ready") {
    return <ReviewFailure locale={locale} path={path} heading="review.credentials.heading" state={result.state} loginHref={gate.loginHref} />;
  }
  return <AdminFrame locale={locale} path={path} current="credentials">
    <Surface className="space-y-6">
      <Heading>{t("review.credentials.heading")}</Heading>
      <p>{t("review.credentials.description")}</p>
      <p>{t("review.separation")}</p>
    </Surface>
    <Surface>
      <section aria-labelledby="credential-queue" className="space-y-4">
        <h2 id="credential-queue" className="text-xl font-semibold text-teal-950">{t("review.credentials.queue")}</h2>
        <p className="text-sm text-slate-700">{t("review.listLimit")}</p>
        {result.credentials.length ? <ul className="space-y-4">
          {result.credentials.map(credential => <li key={credential.credentialId}
            className="space-y-2 rounded-xl border border-slate-300 bg-white p-4 [overflow-wrap:anywhere]">
            <h3 className="text-lg font-semibold text-teal-950">{credential.title}</h3>
            <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="font-semibold">{t("credential.type")}</dt><dd>{t(credentialTypeKey(credential.type))}</dd>
              <dt className="font-semibold">{t("credential.issuer")}</dt><dd>{credential.issuer}</dd>
              {credential.submittedAt && <><dt className="font-semibold">{t("review.submitted")}</dt>
                <dd>{formatInstant(locale, credential.submittedAt)}</dd></>}
            </dl>
            <a className={linkClass} href={`${path}/${encodeURIComponent(credential.credentialId)}`}>
              {t("review.open")}<span className="sr-only">: {credential.title}</span></a>
          </li>)}
        </ul> : <p>{t("review.credentials.none")}</p>}
      </section>
    </Surface>
  </AdminFrame>;
}
