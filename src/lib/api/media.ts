import "server-only";
import { MediaApi, ResponseError, type Configuration, type UploadMediaPurposeEnum } from "@dadzhioski/professional-services-api-client";
import { csrfHeader } from "./session-transport";

export type UploadFailure = "tooLarge" | "unsupported" | "invalid" | "busy";
export type Uploaded = { mediaId: string } | { failure: UploadFailure };

// An upload action makes up to five sequential calls (CSRF, credential read, upload, attach or update,
// discard). Calls are bounded at 5 s, the upload itself at 25 s, and the whole action at 40 s, which
// stays inside the edge upload route's 50 s response timeout (deployment/Caddyfile).
export const uploadBudget = 40_000;
const uploadCallTimeout = 25_000;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Media and credential IDs are UUIDs in the contract.
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

// The same-origin owner content route, served through the edge's /api/* routing. Only well-formed
// IDs are turned into paths, so API-provided values can never point elsewhere.
export function mediaContentPath(mediaId: unknown): string | null {
  return isUuid(mediaId) ? `/api/v1/media/${mediaId}/content` : null;
}

// Administrator evidence reads go through the API's grant check, which audits every attempt.
export function adminMediaContentPath(mediaId: unknown): string | null {
  return isUuid(mediaId) ? `/api/v1/admin/media/${mediaId}/content` : null;
}

// Runs inside an existing csrfMutation; identity failures propagate to its mapping.
export async function uploadImage(configuration: Configuration, token: string, purpose: UploadMediaPurposeEnum,
  file: Blob): Promise<Uploaded> {
  try {
    const media = await new MediaApi(configuration).uploadMedia({ purpose, file },
      async context => ({ ...await csrfHeader(token)(context), signal: AbortSignal.timeout(uploadCallTimeout) }));
    if (!media || !isUuid(media.mediaId)) throw new Error("Malformed media response");
    return { mediaId: media.mediaId };
  } catch (error) {
    if (!(error instanceof ResponseError)) throw error;
    const failure = ({ 413: "tooLarge", 415: "unsupported", 400: "invalid", 422: "invalid", 429: "busy" } as const)[
      error.response.status as 413 | 415 | 400 | 422 | 429];
    if (failure) return { failure };
    throw error;
  }
}

// Best effort: the API refuses to delete attached images and removes unreferenced ones after 24 hours,
// so a failed or ambiguous attach can always try this without risking a live reference.
export async function discardImage(configuration: Configuration, token: string, mediaId: string) {
  try { await new MediaApi(configuration).deleteMedia({ mediaId }, csrfHeader(token)); } catch { /* cleanup covers it */ }
}
