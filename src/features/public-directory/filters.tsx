import type { CityResponse, CountryResponse, SpecialtyResponse } from "@dadzhioski/professional-services-api-client";
import { Button } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";
import { directoryHref } from "./query";
import { publicLinkClass } from "./results";

const selectClass = "block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2";

// A plain GET form: it works without JavaScript and submitting it always returns to the first page.
export function DirectoryFilters({ locale, specialties, cities, countries, specialtyId, cityId }: {
  locale: Locale; specialties: SpecialtyResponse[]; cities: CityResponse[]; countries?: CountryResponse[];
  specialtyId?: string; cityId?: string;
}) {
  const t = translator(locale);
  const countryCodes = [...new Set(cities.map(city => city.countryCode!))];
  const countryLabel = (code: string) => referenceLabel(countries?.find(country => country.code === code)?.labels, code, locale);
  return <form method="get" action={directoryHref(locale)} aria-labelledby="directory-filters"
    className="space-y-4 rounded-xl border border-slate-300 bg-white p-6">
    <h2 id="directory-filters" className="text-xl font-semibold text-teal-950">{t("directory.filters")}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <label htmlFor="directory-specialty" className="block font-semibold">{t("directory.specialty")}</label>
        <select id="directory-specialty" name="specialty" defaultValue={specialtyId ?? ""} className={selectClass}>
          <option value="">{t("directory.anySpecialty")}</option>
          {specialties.map(specialty => <option key={specialty.id} value={specialty.id}>
            {referenceLabel(specialty.labels, specialty.code!, locale)}</option>)}
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="directory-city" className="block font-semibold">{t("directory.city")}</label>
        <select id="directory-city" name="city" defaultValue={cityId ?? ""} className={selectClass}>
          <option value="">{t("directory.anyCity")}</option>
          {countryCodes.map(code => <optgroup key={code} label={countryLabel(code)}>
            {cities.filter(city => city.countryCode === code).map(city => <option key={city.id} value={city.id}>
              {referenceLabel(city.labels, city.code!, locale)}</option>)}
          </optgroup>)}
        </select>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <Button type="submit">{t("directory.apply")}</Button>
      {(specialtyId || cityId) && <a className={publicLinkClass} href={directoryHref(locale)}>{t("directory.reset")}</a>}
    </div>
  </form>;
}
