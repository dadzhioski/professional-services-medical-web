import "server-only";
import { CredentialsApi, ResponseError, UploadMediaPurposeEnum, type Configuration, type CredentialResponse,
  type UpdateCredentialRequest } from "@dadzhioski/professional-services-api-client";
import { imageLimits } from "@/features/media/limits";
import { discardImage, isUuid, uploadImage, uploadBudget, type UploadFailure } from "./media";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

export type Credential = CredentialResponse & Required<Pick<CredentialResponse,
  "credentialId" | "version" | "title" | "issuer" | "type" | "state" | "issuedOn" | "evidenceMediaIds">>;
export type CredentialsResult = { state: "ready"; credentials: Credential[] } | { state: IdentityState };
export type EvidenceResult = { state: "saved" | "removed" | "invalid" | "conflict" | "full" | "missing" | UploadFailure | IdentityState };

const validDate = (value: unknown) => value instanceof Date && !Number.isNaN(value.getTime());

// Evidence changes resend every field, so a credential is only usable when all of them are well formed.
function valid(credential: CredentialResponse | null | undefined): credential is Credential {
  if (!credential || !isUuid(credential.credentialId) || !Number.isSafeInteger(credential.version)) return false;
  const evidence = credential.evidenceMediaIds ?? [];
  if (!Array.isArray(evidence) || !evidence.every(isUuid)) return false;
  credential.evidenceMediaIds = evidence;
  return typeof credential.title === "string" && typeof credential.issuer === "string" && typeof credential.type === "string" &&
    typeof credential.state === "string" && validDate(credential.issuedOn) &&
    (credential.expiresOn === undefined || credential.expiresOn === null || validDate(credential.expiresOn));
}

export async function readCredentials(session?: string): Promise<CredentialsResult> {
  if (!session) return { state: "signedOut" };
  try {
    const credentials = await new CredentialsApi(sessionConfiguration(session)).listCredentials();
    return Array.isArray(credentials) && credentials.every(valid) ? { state: "ready", credentials } : { state: "unavailable" };
  } catch (error) { return { state: failure(error, session) }; }
}

// The current credential is reread so a change never resends fields the owner has not seen.
async function current(configuration: Configuration, credentialId: string, version: number): Promise<{ credential: Credential } | { result: EvidenceResult }> {
  try {
    const credential = await new CredentialsApi(configuration).getCredential({ credentialId });
    if (!valid(credential)) return { result: { state: "unavailable" } };
    return credential.version === version ? { credential } : { result: { state: "conflict" } };
  } catch (error) {
    if (error instanceof ResponseError && [400, 404].includes(error.response.status)) return { result: { state: "missing" } };
    throw error;
  }
}

async function update(configuration: Configuration, token: string, credential: Credential, evidenceMediaIds: string[]) {
  const request: UpdateCredentialRequest = { type: credential.type as UpdateCredentialRequest["type"], title: credential.title,
    issuer: credential.issuer, issuedOn: credential.issuedOn, expiresOn: credential.expiresOn ?? undefined,
    evidenceMediaIds, version: credential.version };
  await new CredentialsApi(configuration).updateCredential({ credentialId: credential.credentialId, updateCredentialRequest: request },
    csrfHeader(token));
}

function rejection(error: unknown): EvidenceResult | undefined {
  if (!(error instanceof ResponseError)) return { state: "unavailable" };
  if (error.response.status === 409) return { state: "conflict" };
  if (error.response.status === 400 || error.response.status === 422) return { state: "invalid" };
  if (error.response.status === 404) return { state: "missing" };
}

export async function addEvidence(origin: string | null, session: string | undefined, apply: ApplySession,
  credentialId: string, version: number, file: Blob): Promise<EvidenceResult> {
  if (!isUuid(credentialId)) return { state: "missing" };
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<EvidenceResult> => {
    const found = await current(configuration, credentialId, version);
    if ("result" in found) return found.result;
    const { credential } = found;
    const existing = credential.evidenceMediaIds;
    if (existing.length >= imageLimits.maxEvidence) return { state: "full" };
    const uploaded = await uploadImage(configuration, token, UploadMediaPurposeEnum.CredentialEvidence, file);
    if ("failure" in uploaded) return { state: uploaded.failure };
    try {
      await update(configuration, token, credential, [...existing, uploaded.mediaId]);
      return { state: "saved" };
    } catch (error) {
      await discardImage(configuration, token, uploaded.mediaId);
      const rejected = rejection(error);
      if (rejected) return rejected;
      throw error;
    }
  }, uploadBudget);
  return result.ok ? result.value : { state: result.state };
}

export async function removeEvidence(origin: string | null, session: string | undefined, apply: ApplySession,
  credentialId: string, version: number, mediaId: string): Promise<EvidenceResult> {
  if (!isUuid(credentialId) || !isUuid(mediaId)) return { state: "missing" };
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<EvidenceResult> => {
    const found = await current(configuration, credentialId, version);
    if ("result" in found) return found.result;
    const { credential } = found;
    const existing = credential.evidenceMediaIds;
    if (!existing.includes(mediaId)) return { state: "missing" };
    try {
      await update(configuration, token, credential, existing.filter(id => id !== mediaId));
    } catch (error) {
      const rejected = rejection(error);
      if (rejected) return rejected;
      throw error;
    }
    // The API deletes removed evidence itself.
    return { state: "removed" };
  });
  return result.ok ? result.value : { state: result.state };
}
