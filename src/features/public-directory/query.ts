import type { Locale } from "@/lib/i18n";

export type DirectoryQuery = { specialtyId?: string; cityId?: string; page: number; invalid: boolean };
export type SearchParams = Record<string, string | string[] | undefined>;
type Known = { id?: string }[] | undefined;

// Only reference IDs from the loaded lists and a positive 1-based page reach the API; other parameter names are ignored.
// An empty value is the form's "all" option. A filter cannot be checked while its reference list is unavailable.
export function parseDirectoryQuery(params: SearchParams, specialties: Known, cities: Known): DirectoryQuery {
  let invalid = false;
  const value = (name: string) => {
    const raw = params[name];
    if (Array.isArray(raw)) { invalid = true; return undefined; }
    return raw === "" ? undefined : raw;
  };
  const known = (raw: string | undefined, list: Known) => {
    if (raw === undefined) return undefined;
    if (list?.some(item => item.id === raw)) return raw;
    invalid = true;
    return undefined;
  };
  const specialtyId = known(value("specialty"), specialties);
  const cityId = known(value("city"), cities);
  const rawPage = value("page");
  let page = 1;
  if (rawPage !== undefined) {
    if (/^[1-9]\d{0,5}$/.test(rawPage)) page = Number(rawPage); else invalid = true;
  }
  return { specialtyId, cityId, page, invalid };
}

export function directoryHref(locale: Locale, { specialtyId, cityId, page = 1 }: Partial<Omit<DirectoryQuery, "invalid">> = {}) {
  const query = new URLSearchParams();
  if (specialtyId) query.set("specialty", specialtyId);
  if (cityId) query.set("city", cityId);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return `/${locale}/doctors${search ? `?${search}` : ""}`;
}
