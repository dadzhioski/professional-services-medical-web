import "server-only";
import { ProfileApi, PublicationResponsePublicationStateEnum, ResponseError, UploadMediaPurposeEnum, type Configuration, type EditProfileRequest,
  type ProfileResponse, type PublicationResponse } from "@dadzhioski/professional-services-api-client";
import { discardImage, uploadImage, uploadBudget, type UploadFailure } from "./media";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

export type ProfileResult = { state: "ready"; profile: ProfileResponse } | { state: "missing" } | { state: IdentityState };
export type SaveResult = { state: "saved"; profile: ProfileResponse } | { state: "invalid" } |
  { state: "conflict"; latest?: ProfileResponse } | { state: IdentityState };
export type ProfileDraft = Required<EditProfileRequest>;
export type PhotoResult = { state: "saved" | "removed" | "invalid" | "conflict" | UploadFailure | IdentityState };

const optionalText = (value: unknown) => value === undefined || value === null || typeof value === "string";

// The slug and version drive identity and concurrency; anything else malformed is not shown.
function valid(profile: ProfileResponse | null | undefined): profile is ProfileResponse {
  return !!profile && typeof profile.slug === "string" && !!profile.slug && Number.isSafeInteger(profile.version) &&
    optionalText(profile.displayName) && optionalText(profile.biography) && optionalText(profile.publicationState) &&
    optionalText(profile.photoMediaId);
}

// The API derives the organization from the session; callers never supply profile identifiers.
async function readWith(configuration: Configuration, session: string): Promise<ProfileResult> {
  try {
    const profile = await new ProfileApi(configuration).getProfile();
    return valid(profile) ? { state: "ready", profile } : { state: "unavailable" };
  } catch (error) {
    if (error instanceof ResponseError && error.response.status === 404) return { state: "missing" };
    return { state: failure(error, session) };
  }
}

export async function readProfile(session?: string): Promise<ProfileResult> {
  if (!session) return { state: "signedOut" };
  return readWith(sessionConfiguration(session), session);
}

export async function createProfile(origin: string | null, session: string | undefined,
  apply: ApplySession): Promise<"ready" | IdentityState> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token, validSession): Promise<"ready" | IdentityState> => {
    try {
      if (valid(await new ProfileApi(configuration).createOrGetProfile(csrfHeader(token)))) return "ready";
    } catch (error) {
      if (error instanceof ResponseError && [401, 403].includes(error.response.status)) throw error;
    }
    // The outcome is ambiguous; only a fresh read can show that the draft exists.
    const current = await readWith(configuration, validSession);
    if (current.state === "ready") return "ready";
    return current.state === "missing" ? "unavailable" : current.state;
  });
  return result.ok ? result.value : result.state;
}

export async function saveProfile(origin: string | null, session: string | undefined, apply: ApplySession,
  draft: ProfileDraft): Promise<SaveResult> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token, validSession): Promise<SaveResult> => {
    try {
      // The API replaces both fields, so both are always sent.
      const profile = await new ProfileApi(configuration).editProfile({ editProfileRequest: draft }, csrfHeader(token));
      return valid(profile) ? { state: "saved", profile } : { state: "unavailable" };
    } catch (error) {
      if (!(error instanceof ResponseError)) return { state: "unavailable" };
      if (error.response.status === 400) return { state: "invalid" };
      if (error.response.status !== 409) throw error;
    }
    // A stale edit is never retried; the latest version is returned for explicit review.
    const latest = await readWith(configuration, validSession);
    if (latest.state === "ready") return { state: "conflict", latest: latest.profile };
    return latest.state === "missing" || latest.state === "unavailable" ? { state: "conflict" } : { state: latest.state };
  });
  return result.ok ? result.value : { state: result.state };
}

// Stale, malformed and unusable requests are rejected without changing the profile.
function photoRejection(error: unknown): PhotoResult | undefined {
  if (!(error instanceof ResponseError)) return { state: "unavailable" };
  if (error.response.status === 409) return { state: "conflict" };
  if (error.response.status === 400 || error.response.status === 422) return { state: "invalid" };
  if (error.response.status === 404) return { state: "unavailable" };
}

// Upload and attach run under one CSRF bootstrap. The API keeps the previous photo unless the attach succeeds.
export async function replacePhoto(origin: string | null, session: string | undefined, apply: ApplySession,
  version: number, file: Blob): Promise<PhotoResult> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<PhotoResult> => {
    const uploaded = await uploadImage(configuration, token, UploadMediaPurposeEnum.ProfilePhoto, file);
    if ("failure" in uploaded) return { state: uploaded.failure };
    try {
      const profile = await new ProfileApi(configuration).attachProfilePhoto(
        { attachPhotoRequest: { mediaId: uploaded.mediaId, version } }, csrfHeader(token));
      if (valid(profile) && profile.photoMediaId === uploaded.mediaId) return { state: "saved" };
      return { state: "unavailable" };
    } catch (error) {
      // Never leave an unattached upload behind on purpose; deletion of an attached image is refused upstream.
      await discardImage(configuration, token, uploaded.mediaId);
      const rejected = photoRejection(error);
      if (rejected) return rejected;
      throw error;
    }
  }, uploadBudget);
  return result.ok ? result.value : { state: result.state };
}

export async function removePhoto(origin: string | null, session: string | undefined, apply: ApplySession,
  version: number): Promise<PhotoResult> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<PhotoResult> => {
    try {
      const profile = await new ProfileApi(configuration).detachProfilePhoto({ version }, csrfHeader(token));
      return valid(profile) && !profile.photoMediaId ? { state: "removed" } : { state: "unavailable" };
    } catch (error) {
      const rejected = photoRejection(error);
      if (rejected) return rejected;
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}

export type Publication = PublicationResponse;
export type PublicationResult = { state: "ready"; publication: Publication } | { state: "missing" } | { state: IdentityState };
export type PublishResult = { state: "published" | "unpublished" | "conflict" | "incomplete" | "missing" | IdentityState };

const publicationStates: readonly string[] = Object.values(PublicationResponsePublicationStateEnum);

// Unknown missing parts are kept: the page names them generically instead of hiding a blocker.
function validPublication(publication: PublicationResponse | null | undefined): publication is Publication {
  return !!publication && typeof publication.approved === "boolean" && typeof publication.suspended === "boolean" &&
    Number.isSafeInteger(publication.version) && publicationStates.includes(publication.publicationState) &&
    Array.isArray(publication.missing) && publication.missing.every(part => typeof part === "string");
}

// Eligibility and missing parts come from the API; the web never recomputes them.
export async function readPublication(session?: string): Promise<PublicationResult> {
  if (!session) return { state: "signedOut" };
  try {
    const publication = await new ProfileApi(sessionConfiguration(session)).getProfilePublication();
    return validPublication(publication) ? { state: "ready", publication } : { state: "unavailable" };
  } catch (error) {
    if (error instanceof ResponseError && error.response.status === 404) return { state: "missing" };
    return { state: failure(error, session) };
  }
}

// 422 lists missing parts in its body; the page rereads the publication state instead of parsing problem details.
export async function changePublication(origin: string | null, session: string | undefined, apply: ApplySession,
  publish: boolean, version: number): Promise<PublishResult> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<PublishResult> => {
    const api = new ProfileApi(configuration);
    try {
      const profile = publish ? await api.publishProfile({ publicationRequest: { version } }, csrfHeader(token)) :
        await api.unpublishProfile({ version }, csrfHeader(token));
      if (!valid(profile)) return { state: "unavailable" };
      return { state: publish ? "published" : "unpublished" };
    } catch (error) {
      if (!(error instanceof ResponseError)) return { state: "unavailable" };
      if (error.response.status === 409) return { state: "conflict" };
      if (error.response.status === 422) return { state: "incomplete" };
      if (error.response.status === 404) return { state: "missing" };
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}
