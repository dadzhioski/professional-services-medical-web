import "server-only";
import { LocationsApi, type CreateLocationRequest, type PracticeLocationResponse } from "@dadzhioski/professional-services-api-client";
import { changeRecord, identifier, listRecords, optionalText, removeRecord } from "./owned-records";
import type { ApplySession } from "./session-transport";

export type LocationDraft = CreateLocationRequest;

function valid(location: PracticeLocationResponse | null | undefined): location is PracticeLocationResponse {
  return !!location && identifier(location.locationId) && Number.isSafeInteger(location.version) &&
    identifier(location.cityId) && typeof location.countryCode === "string" && /^[A-Z]{2}$/.test(location.countryCode) &&
    optionalText(location.displayAddress) && optionalText(location.label);
}

export const listLocations = (session?: string) =>
  listRecords(session, configuration => new LocationsApi(configuration).listPracticeLocations(), valid);

export const createLocation = (origin: string | null, session: string | undefined, apply: ApplySession, draft: LocationDraft) =>
  changeRecord(origin, session, apply,
    (configuration, init) => new LocationsApi(configuration).createPracticeLocation({ createLocationRequest: draft }, init), valid);

export const updateLocation = (origin: string | null, session: string | undefined, apply: ApplySession,
  locationId: string, draft: LocationDraft, version: number) =>
  changeRecord(origin, session, apply,
    (configuration, init) => new LocationsApi(configuration).updatePracticeLocation(
      { locationId, updateLocationRequest: { ...draft, version } }, init),
    valid, configuration => new LocationsApi(configuration).getPracticeLocation({ locationId }));

// The API also unlinks the location from every service in the same transaction.
export const deleteLocation = (origin: string | null, session: string | undefined, apply: ApplySession, locationId: string) =>
  removeRecord(origin, session, apply,
    (configuration, init) => new LocationsApi(configuration).deletePracticeLocation({ locationId }, init));
