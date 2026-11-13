import "server-only";
import { ReferenceApi, type CityResponse, type Configuration, type CountryResponse, type SpecialtyResponse } from "@dadzhioski/professional-services-api-client";
import { identifier, optionalText } from "./owned-records";
import { sessionConfiguration } from "./session-transport";

export type ReferenceList<T> = { state: "ready"; records: T[] } | { state: "unavailable" };

const code = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value);
const labels = (value: unknown) => value === undefined || value === null ||
  (typeof value === "object" && Object.values(value).every(optionalText));

// Reference data is anonymous, so no session cookie is forwarded.
async function list<T>(read: (api: ReferenceApi) => Promise<T[]>, valid: (record: T) => boolean): Promise<ReferenceList<T>> {
  try {
    const configuration: Configuration = sessionConfiguration(undefined);
    const records = await read(new ReferenceApi(configuration));
    return Array.isArray(records) && records.every(valid) ? { state: "ready", records } : { state: "unavailable" };
  } catch { return { state: "unavailable" }; }
}

export const listSpecialties = () => list<SpecialtyResponse>(api => api.listSpecialties(),
  specialty => !!specialty && identifier(specialty.id) && code(specialty.code) && labels(specialty.labels));

export const listCountries = () => list<CountryResponse>(api => api.listCountries(),
  country => !!country && typeof country.code === "string" && /^[A-Z]{2}$/.test(country.code) && labels(country.labels));

export const listCities = () => list<CityResponse>(api => api.listCities(),
  city => !!city && identifier(city.id) && code(city.code) && typeof city.countryCode === "string" &&
    /^[A-Z]{2}$/.test(city.countryCode) && labels(city.labels));
