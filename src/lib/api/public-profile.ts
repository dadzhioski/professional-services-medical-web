import "server-only";
import { cache } from "react";
import { PublicApi, ResponseError, type PublicCredential, type PublicPracticeLocation, type PublicProfileResponse,
  type PublicReference, type PublicService } from "@dadzhioski/professional-services-api-client";
import { amountPattern } from "@/lib/price";
import { identifier, optionalText } from "./owned-records";
import { sessionConfiguration } from "./session-transport";

export type PublicProfileResult = { state: "ready"; profile: PublicProfileResponse } | { state: "missing" } | { state: "unavailable" };

export const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const date = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());
const list = <T>(value: unknown, valid: (item: T) => boolean) =>
  value === undefined || (Array.isArray(value) && value.every(item => !!item && valid(item)));
export const reference = (value: PublicReference | undefined) => value === undefined ||
  (!!value && identifier(value.id) && identifier(value.code) &&
    (value.labels === undefined || (!!value.labels && Object.values(value.labels).every(optionalText))));
const credential = (value: PublicCredential) => text(value.title) && optionalText(value.issuer) &&
  typeof value.type === "string" && (value.issuedOn === undefined || date(value.issuedOn)) &&
  (value.expiresOn === undefined || value.expiresOn === null || date(value.expiresOn));
const service = (value: PublicService) => text(value.name) && optionalText(value.description) &&
  (value.price === undefined || value.price === null ||
    (typeof value.price.amount === "string" && amountPattern.test(value.price.amount) && typeof value.price.currency === "string"));
const location = (value: PublicPracticeLocation) => text(value.displayAddress) && optionalText(value.label) &&
  (value.countryCode === undefined || (typeof value.countryCode === "string" && /^[A-Z]{2}$/.test(value.countryCode))) &&
  reference(value.city);

function valid(profile: PublicProfileResponse | undefined, slug: string): profile is PublicProfileResponse {
  return !!profile && profile.slug === slug && text(profile.displayName) && optionalText(profile.biography) &&
    optionalText(profile.photoMediaId) && reference(profile.specialty) && list(profile.credentials, credential) &&
    list(profile.services, service) && list(profile.locations, location);
}

// Anonymous published-data read: no visitor cookie is forwarded and nothing is shared between requests.
// React's cache only deduplicates the metadata and page reads of the same request.
export const readPublicProfile = cache(async (slug: string): Promise<PublicProfileResult> => {
  if (!slug || slug.length > 200) return { state: "missing" };
  try {
    const profile = await new PublicApi(sessionConfiguration(undefined)).getPublicProfile({ slug });
    return valid(profile, slug) ? { state: "ready", profile } : { state: "unavailable" };
  } catch (error) {
    // Unknown, unpublished and suspended profiles share one 404 in the contract.
    if (error instanceof ResponseError && error.response.status === 404) return { state: "missing" };
    return { state: "unavailable" };
  }
});
