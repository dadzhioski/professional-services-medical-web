import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Heading, Notice } from "@/components/ui/presentation";
import { OwnerImage } from "@/features/media/owner-image";
import { ProfilePresentation } from "@/features/professional-profile/presentation";
import { publicContent } from "@/features/public-profile/content";
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
    return <><SiteHeader locale={locale} path={path} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
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
  return <><SiteHeader locale={locale} path={path} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <BackLink locale={locale} />
    <ProfilePresentation locale={locale} name={profile.displayName!} introduction={profile.biography ?? undefined}
      photo={photoPath && <OwnerImage path={photoPath} alt="" />} specialties={content.specialties}
      credentials={content.credentials} services={content.services} locations={content.locations} />
    {/* Escaped serialization keeps supplied text inert inside the script element. */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }} />
  </main></>;
}
