import "server-only";
import { ResponseError, type Configuration, type InitOverrideFunction } from "@dadzhioski/professional-services-api-client";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

// Shared result shapes for organization-owned records (services, practice locations, medical extension).
export type RecordList<T> = { state: "ready"; records: T[] } | { state: IdentityState };
export type RecordChange<T> = { state: "saved"; record: T } | { state: "invalid" } | { state: "notFound" } |
  { state: "conflict"; latest?: T } | { state: IdentityState };
export type RecordRemoval = { state: "removed" } | { state: "notFound" } | { state: IdentityState };

export const optionalText = (value: unknown) => value === undefined || value === null || typeof value === "string";
export const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

const status = (error: unknown) => error instanceof ResponseError ? error.response.status : undefined;

// The API derives the organization from the session; callers never supply organization identifiers.
export async function listRecords<T>(session: string | undefined, list: (configuration: Configuration) => Promise<T[]>,
  valid: (record: T) => boolean): Promise<RecordList<T>> {
  if (!session) return { state: "signedOut" };
  try {
    const records = await list(sessionConfiguration(session));
    return Array.isArray(records) && records.every(valid) ? { state: "ready", records } : { state: "unavailable" };
  } catch (error) { return { state: failure(error, session) }; }
}

// A stale edit is never retried; the latest version is re-read for explicit review.
export async function changeRecord<T>(origin: string | null, session: string | undefined, apply: ApplySession,
  change: (configuration: Configuration, init: InitOverrideFunction) => Promise<T>, valid: (record: T) => boolean,
  reread?: (configuration: Configuration) => Promise<T>): Promise<RecordChange<T>> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token, validSession): Promise<RecordChange<T>> => {
    try {
      const record = await change(configuration, csrfHeader(token));
      return valid(record) ? { state: "saved", record } : { state: "unavailable" };
    } catch (error) {
      if (!(error instanceof ResponseError)) return { state: "unavailable" };
      if (status(error) === 400) return { state: "invalid" };
      if (status(error) === 404) return { state: "notFound" };
      // 401/403 are mapped by csrfMutation; anything else is unavailable.
      if (status(error) !== 409 || !reread) throw error;
    }
    try {
      const latest = await reread(configuration);
      return valid(latest) ? { state: "conflict", latest } : { state: "conflict" };
    } catch (error) {
      if (status(error) === 404) return { state: "notFound" };
      const state = failure(error, validSession);
      return state === "unavailable" ? { state: "conflict" } : { state };
    }
  });
  return result.ok ? result.value : { state: result.state };
}

export async function removeRecord(origin: string | null, session: string | undefined, apply: ApplySession,
  remove: (configuration: Configuration, init: InitOverrideFunction) => Promise<void>): Promise<RecordRemoval> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<RecordRemoval> => {
    try {
      await remove(configuration, csrfHeader(token));
      return { state: "removed" };
    } catch (error) {
      if (!(error instanceof ResponseError)) return { state: "unavailable" };
      if (status(error) === 404) return { state: "notFound" };
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}
