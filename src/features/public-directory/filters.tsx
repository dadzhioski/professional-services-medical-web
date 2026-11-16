import type { CityResponse, CountryResponse, SpecialtyResponse } from "@dadzhioski/professional-services-api-client";
import { Button, controlClass } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";
import { directoryHref } from "./query";
import { publicLinkClass } from "./results";

// A plain GET form: it works without JavaScript and submitting it always returns to the first page.
// The grouped panel (WEB-M2-009) keeps visible labels and bordered native selects at every width.
export function DirectoryFilters({ locale, specialties, cities, countries, specialtyId, cityId }: {
  locale: Locale; specialties: SpecialtyResponse[]; cities: CityResponse[]; countries?: CountryResponse[];
  specialtyId?: string; cityId?: string;
}) {
  const t = translator(locale);
  const countryCodes = [...new Set(cities.map(city => city.countryCode!))];
  const countryLabel = (code: string) => referenceLabel(countries?.find(country => country.code === code)?.labels, code, locale);
  return <form method="get" action={directoryHref(locale)} aria-labelledby="directory-filters" className="mx-auto max-w-4xl space-y-3">
    <h2 id="directory-filters" className="sr-only">{t("directory.filters")}</h2>
    <div className="grid gap-4 rounded-card border border-control bg-surface p-4 shadow-hero sm:p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <div className="min-w-0 space-y-1">
        <label htmlFor="directory-specialty" className="block font-semibold text-ink">{t("directory.specialty")}</label>
        <select id="directory-specialty" name="specialty" defaultValue={specialtyId ?? ""} className={controlClass()}>
          <option value="">{t("directory.anySpecialty")}</option>
          {specialties.map(specialty => <option key={specialty.id} value={specialty.id}>
            {referenceLabel(specialty.labels, specialty.code!, locale)}</option>)}
        </select>
      </div>
      <div className="min-w-0 space-y-1">
        <label htmlFor="directory-city" className="block font-semibold text-ink">{t("directory.city")}</label>
        <select id="directory-city" name="city" defaultValue={cityId ?? ""} className={controlClass()}>
          <option value="">{t("directory.anyCity")}</option>
          {countryCodes.map(code => <optgroup key={code} label={countryLabel(code)}>
            {cities.filter(city => city.countryCode === code).map(city => <option key={city.id} value={city.id}>
              {referenceLabel(city.labels, city.code!, locale)}</option>)}
          </optgroup>)}
        </select>
      </div>
      <Button type="submit" className="w-full md:w-auto">{t("directory.apply")}</Button>
    </div>
    {(specialtyId || cityId) && <p className="text-center"><a className={publicLinkClass} href={directoryHref(locale)}>{t("directory.reset")}</a></p>}
  </form>;
}
