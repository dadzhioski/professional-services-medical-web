import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { cardClass, Heading, Notice, pageContainerClass } from "@/components/ui/presentation";
import { OwnerImage } from "@/features/media/owner-image";
import { ProfilePresentation } from "@/features/professional-profile/presentation";
import { publicContent } from "@/features/public-profile/content";
import { directoryHref } from "@/features/public-directory/query";
import { publicLinkClass } from "@/features/public-directory/results";
import { publicMediaContentPath } from "@/lib/api/media";
import { readPublicProfile } from "@/lib/api/public-profile";
import { isLocale, translator, type Locale } from "@/lib/i18n";
import { canonicalUrl, languageAlternates } from "@/lib/seo/canonical";
import { physicianJsonLd, serializeJsonLd } from "@/lib/seo/structured-data";

// Every request re-reads publication state; nothing is cached or shared between visitors.
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; slug: string }> };

const profilePath = (slug: string) => `/doctors/${encodeURIComponent(slug)}`;
const BackLink = ({ locale }: { locale: Locale }) =>
  <a className={publicLinkClass} href={`/${locale}/doctors`}>{translator(locale)("publicProfile.backToDirectory")}</a>;

// Doctors / specialty / name (WEB-M2-009). The specialty links to the directory filtered by it; the last item is this page.
function Breadcrumb({ locale, specialty, specialtyId, name }: { locale: Locale; specialty?: string; specialtyId?: string; name: string }) {
  const t = translator(locale);
  const separator = <span aria-hidden="true" className="text-muted">/</span>;
  return <nav aria-label={t("publicProfile.breadcrumb")}>
    <ol className="flex flex-wrap items-center gap-x-2 [overflow-wrap:anywhere]">
      <li className="flex items-center gap-2"><a className={publicLinkClass} href={directoryHref(locale)}>{t("directory.title")}</a>{separator}</li>
      {specialty && <li className="flex items-center gap-2">{specialtyId
        ? <a className={publicLinkClass} href={directoryHref(locale, { specialtyId })}>{specialty}</a> : <span>{specialty}</span>}{separator}</li>}
      <li className="min-w-0"><span aria-current="page" className="text-ink">{name}</span></li>
    </ol>
  </nav>;
}

// Supports the data-scope rule: the site never asks for medical details.
function PrivacyNote({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return <section aria-labelledby="profile-privacy" className={`space-y-3 p-6 ${cardClass}`}>
    <h2 id="profile-privacy" className="text-lg font-semibold text-ink">{t("publicProfile.privacyTitle")}</h2>
    <p className="text-sm leading-relaxed">{t("publicProfile.privacyNote")}</p>
  </section>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const result = await readPublicProfile(slug);
  if (result.state === "missing") notFound();
  // A failed read is never indexed and carries no profile content.
  if (result.state !== "ready") return { title: t("publicProfile.unavailableTitle"), robots: { index: false, follow: false } };
  const { profile } = result;
  const { title, description } = publicContent(profile, locale);
  const url = canonicalUrl(locale, profilePath(profile.slug!));
  return {
    title, description,
    alternates: { canonical: url, languages: languageAlternates(profilePath(profile.slug!)) },
    openGraph: { type: "profile", url, title, description, locale, siteName: t("app.title") },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const result = await readPublicProfile(slug);
  if (result.state === "missing") notFound();
  const path = `/${locale}${profilePath(slug)}`;
  if (result.state !== "ready") {
    return <><SiteHeader locale={locale} path={path} /><main id="main-content" tabIndex={-1} className={`${pageContainerClass} space-y-6`}>
      <BackLink locale={locale} />
      <Heading>{t("publicProfile.unavailableTitle")}</Heading>
      <Notice role="alert">{t("publicProfile.unavailable")}</Notice>
    </main></>;
  }
  const { profile } = result;
  const content = publicContent(profile, locale);
  const photoPath = publicMediaContentPath(profile.photoMediaId);
  const structured = physicianJsonLd({ name: profile.displayName!, url: canonicalUrl(locale, profilePath(profile.slug!)),
    description: content.description, ...content.structured });
  return <><SiteHeader locale={locale} path={path} /><main id="main-content" tabIndex={-1} className={`${pageContainerClass} space-y-6`}>
    <Breadcrumb locale={locale} specialty={content.specialties[0]} specialtyId={content.specialtyId} name={profile.displayName!} />
    <ProfilePresentation locale={locale} name={profile.displayName!} introduction={profile.biography ?? undefined}
      photo={photoPath && <OwnerImage path={photoPath} alt="" />} specialties={content.specialties} cities={content.cities}
      credentials={content.credentials} services={content.services} locations={content.locations}
      aside={<PrivacyNote locale={locale} />} />
    {/* Escaped serialization keeps supplied text inert inside the script element. */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }} />
  </main></>;
}
