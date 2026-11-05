import type { PublicDoctorPage, PublicDoctorSummary } from "@dadzhioski/professional-services-api-client";
import { cardClass, linkClass } from "@/components/ui/presentation";
import { OwnerImage } from "@/features/media/owner-image";
import { publicMediaContentPath } from "@/lib/api/media";
import { translator, type Locale } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";
import { directoryHref } from "./query";

type Filters = { specialtyId?: string; cityId?: string };
// 44 px touch targets on public pages.
export const publicLinkClass = `${linkClass} min-h-11`;

// Decorative initials when there is no photo; the linked name beside it is the accessible text.
export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => [...part.normalize("NFC")][0]).join("").toLocaleUpperCase();
}

// Only the named public summary fields are shown; supplied names and labels are rendered as text.
function DoctorCard({ locale, doctor }: { locale: Locale; doctor: PublicDoctorSummary }) {
  const t = translator(locale);
  const photo = publicMediaContentPath(doctor.photoMediaId);
  const cities = [...new Map((doctor.cities ?? []).map(city => [city.id, city])).values()]
    .map(city => referenceLabel(city.labels, city.code!, locale));
  return <article className={`flex h-full gap-4 p-5 ${cardClass}`}>
    {photo ? <OwnerImage path={photo} alt="" thumbnail />
      : <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-input bg-tint text-lg font-semibold text-ink">
        {initials(doctor.displayName ?? "")}</span>}
    <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
      <h2 className="text-lg font-semibold leading-snug text-ink">
        <a className="text-primary underline underline-offset-4 hover:text-primary-strong" href={`/${locale}/doctors/${encodeURIComponent(doctor.slug!)}`}>
          {doctor.displayName}</a>
      </h2>
      <dl className="grid gap-x-3 text-muted">
        {doctor.specialty && <><dt className="font-semibold">{t("directory.specialty")}</dt>
          <dd>{referenceLabel(doctor.specialty.labels, doctor.specialty.code!, locale)}</dd></>}
        {cities.length > 0 && <><dt className="font-semibold">{t("directory.cities")}</dt><dd>{cities.join(", ")}</dd></>}
      </dl>
    </div>
  </article>;
}

export function DirectoryPagination({ locale, filters, page, totalPages }: { locale: Locale; filters: Filters; page: number;
  totalPages: number }) {
  const t = translator(locale);
  const href = (target: number) => directoryHref(locale, { ...filters, page: target });
  return <nav aria-label={t("directory.pagination")}>
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {page > 1 && <li><a className={publicLinkClass} rel="prev" href={href(page - 1)}>{t("directory.previous")}</a></li>}
      <li><a className={publicLinkClass} aria-current="page" href={href(page)}>
        {`${t("directory.page")} ${page} ${t("directory.of")} ${totalPages}`}</a></li>
      {page < totalPages && <li><a className={publicLinkClass} rel="next" href={href(page + 1)}>{t("directory.next")}</a></li>}
    </ul>
  </nav>;
}

// page is 1-based here; the API page is 0-based.
export function DirectoryResults({ locale, result, filters, page }: { locale: Locale; result: PublicDoctorPage; filters: Filters;
  page: number }) {
  const t = translator(locale);
  const doctors = result.content!;
  const totalPages = result.totalPages!;
  const filtered = !!(filters.specialtyId || filters.cityId);
  if (!doctors.length && totalPages > 0) {
    return <div className="space-y-2"><p>{t("directory.beyondEnd")}</p>
      <a className={publicLinkClass} href={directoryHref(locale, { ...filters, page: totalPages })}>{t("directory.lastPage")}</a></div>;
  }
  if (!doctors.length) {
    return filtered ? <div className="space-y-2"><p>{t("directory.noMatch")}</p>
      <a className={publicLinkClass} href={directoryHref(locale)}>{t("directory.reset")}</a></div> : <p>{t("directory.empty")}</p>;
  }
  return <div className="space-y-4">
    <p className="font-semibold text-ink">{`${t("directory.count")}: ${result.totalElements}`}</p>
    <ul className="grid gap-6 sm:grid-cols-2">{doctors.map(doctor => <li key={doctor.slug}><DoctorCard locale={locale} doctor={doctor} /></li>)}</ul>
    {totalPages > 1 && <DirectoryPagination locale={locale} filters={filters} page={page} totalPages={totalPages} />}
  </div>;
}
