import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SiteHeader } from "@/components/site-header";
import { Heading, Notice } from "@/components/ui/presentation";
import { DirectoryFilters } from "@/features/public-directory/filters";
import { directoryHref, parseDirectoryQuery, type SearchParams } from "@/features/public-directory/query";
import { DirectoryResults, publicLinkClass } from "@/features/public-directory/results";
import { readPublicDirectory } from "@/lib/api/public-directory";
import { listCities, listCountries, listSpecialties } from "@/lib/api/reference";
import { isLocale, translator, type Locale } from "@/lib/i18n";
import { canonicalUrl, languageAlternates } from "@/lib/seo/canonical";

// Every request re-reads publication state; nothing is cached or shared between visitors.
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

// React's cache only deduplicates the metadata and page reads of the same request.
const references = cache(() => Promise.all([listSpecialties(), listCities(), listCountries()]));

async function load(locale: string, search: SearchParams) {
  if (!isLocale(locale)) notFound();
  const [specialties, cities, countries] = await references();
  const query = parseDirectoryQuery(search, specialties.state === "ready" ? specialties.records : undefined,
    cities.state === "ready" ? cities.records : undefined);
  // Invalid input never reaches the API.
  const result = query.invalid ? { state: "invalid" as const } :
    await readPublicDirectory(query.specialtyId, query.cityId, query.page - 1);
  return { locale, query, result, specialties, cities, countries };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, query, result } = await load((await params).locale, await searchParams);
  const t = translator(locale);
  // A failed read is never indexed and carries no canonical.
  if (result.state === "unavailable") return { title: t("directory.unavailableTitle"), robots: { index: false, follow: false } };
  // Only the first unfiltered page is indexed; filtered, later and invalid pages point to it (owner decision 4).
  const primary = result.state === "ready" && !query.specialtyId && !query.cityId && query.page === 1;
  const title = t("directory.title");
  const description = t("directory.description");
  const url = canonicalUrl(locale, "/doctors");
  return {
    title, description,
    alternates: { canonical: url, languages: languageAlternates("/doctors") },
    openGraph: { type: "website", url, title, description, locale, siteName: t("app.title") },
    robots: { index: primary, follow: true },
  };
}

function Body({ locale, query, result }: Pick<Awaited<ReturnType<typeof load>>, "query" | "result"> & { locale: Locale }) {
  const t = translator(locale);
  if (result.state === "unavailable") return <Notice role="alert">{t("directory.unavailable")}</Notice>;
  if (result.state === "invalid") {
    return <div className="space-y-2"><Notice>{t("directory.invalid")}</Notice>
      <a className={publicLinkClass} href={directoryHref(locale)}>{t("directory.reset")}</a></div>;
  }
  return <DirectoryResults locale={locale} result={result.page} filters={query} page={query.page} />;
}

export default async function DirectoryPage({ params, searchParams }: Props) {
  const { locale, query, result, specialties, cities, countries } = await load((await params).locale, await searchParams);
  const t = translator(locale);
  // Language links drop query parameters, so switching language resets the filters.
  return <><SiteHeader locale={locale} path={directoryHref(locale)} current="directory" /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <Heading>{t("directory.heading")}</Heading>
    <p className="leading-relaxed text-slate-700">{t("directory.intro")}</p>
    {specialties.state === "ready" && cities.state === "ready"
      ? <DirectoryFilters locale={locale} specialties={specialties.records} cities={cities.records}
        countries={countries.state === "ready" ? countries.records : undefined} specialtyId={query.specialtyId} cityId={query.cityId} />
      : <p>{t("directory.referencesUnavailable")}</p>}
    <Body locale={locale} query={query} result={result} />
  </main></>;
}
