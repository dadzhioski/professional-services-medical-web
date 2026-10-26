import "server-only";
import { cache } from "react";
import { PublicApi, ResponseError, type PublicDoctorPage, type PublicDoctorSummary } from "@dadzhioski/professional-services-api-client";
import { optionalText } from "./owned-records";
import { reference, text } from "./public-profile";
import { sessionConfiguration } from "./session-transport";

export type PublicDirectoryResult = { state: "ready"; page: PublicDoctorPage } | { state: "invalid" } | { state: "unavailable" };
export const directoryPageSize = 20;

const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const summary = (value: PublicDoctorSummary) => !!value && text(value.slug) && value.slug.length <= 200 &&
  text(value.displayName) && optionalText(value.photoMediaId) && reference(value.specialty) &&
  (value.cities === undefined || (Array.isArray(value.cities) && value.cities.every(city => !!city && reference(city))));

function valid(result: PublicDoctorPage | undefined, page: number): result is PublicDoctorPage {
  return !!result && result.page === page && count(result.size) && count(result.totalElements) && count(result.totalPages) &&
    Array.isArray(result.content) && result.content.length <= directoryPageSize && result.content.every(summary);
}

// Anonymous published-data read: no visitor cookie is forwarded and nothing is shared between requests.
// React's cache only deduplicates the metadata and page reads of the same request. Callers validate filters first.
export const readPublicDirectory = cache(async (specialtyId: string | undefined, cityId: string | undefined,
  page: number): Promise<PublicDirectoryResult> => {
  try {
    const result = await new PublicApi(sessionConfiguration(undefined))
      .listPublicDoctors({ specialtyId, cityId, page, size: directoryPageSize });
    return valid(result, page) ? { state: "ready", page: result } : { state: "unavailable" };
  } catch (error) {
    // Malformed filters or paging are Problem Details 400s; never surface the raw response.
    if (error instanceof ResponseError && error.response.status === 400) return { state: "invalid" };
    return { state: "unavailable" };
  }
});
