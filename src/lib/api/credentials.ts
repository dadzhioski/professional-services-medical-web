import "server-only";
import { CredentialsApi, ResponseError, UploadMediaPurposeEnum, type Configuration, type CredentialResponse,
  type UpdateCredentialRequest } from "@dadzhioski/professional-services-api-client";
import { imageLimits } from "@/features/media/limits";
import { discardImage, isUuid, uploadImage, uploadBudget, type UploadFailure } from "./media";
import { changeRecord, type RecordChange } from "./owned-records";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

export type Credential = CredentialResponse & Required<Pick<CredentialResponse,
  "credentialId" | "version" | "title" | "issuer" | "type" | "state" | "issuedOn" | "evidenceMediaIds">>;
export type CredentialsResult = { state: "ready"; credentials: Credential[] } | { state: IdentityState };
// Field edits never carry evidence: the API's current evidence list is resent unchanged.
export type CredentialDraft = Omit<UpdateCredentialRequest, "version" | "evidenceMediaIds">;
export type SubmitResult = { state: "submitted" | "conflict" | "evidenceRequired" | "missing" | IdentityState };
export type DeleteResult = { state: "removed" | "conflict" | "missing" | IdentityState };
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

const status = (error: unknown) => error instanceof ResponseError ? error.response.status : undefined;

// New credentials start as drafts without evidence; images are then added through the evidence upload.
export const createCredential = (origin: string | null, session: string | undefined, apply: ApplySession, draft: CredentialDraft) =>
  changeRecord<CredentialResponse>(origin, session, apply,
    (configuration, init) => new CredentialsApi(configuration).createCredential({ credentialRequest: draft }, init), valid);

// The credential is reread at the owner's version, so a field edit never resends evidence the owner has not
// seen and the browser never supplies evidence IDs. A stale edit returns the latest values for explicit review.
export async function updateCredentialFields(origin: string | null, session: string | undefined, apply: ApplySession,
  credentialId: string, draft: CredentialDraft, version: number): Promise<RecordChange<Credential>> {
  if (!isUuid(credentialId)) return { state: "notFound" };
  const result = await csrfMutation(origin, session, apply, async (configuration, token, validSession): Promise<RecordChange<Credential>> => {
    const api = new CredentialsApi(configuration);
    let credential: CredentialResponse;
    try { credential = await api.getCredential({ credentialId }); } catch (error) {
      if (status(error) === 400 || status(error) === 404) return { state: "notFound" };
      throw error;
    }
    if (!valid(credential)) return { state: "unavailable" };
    if (credential.version !== version) return { state: "conflict", latest: credential };
    try {
      const saved = await api.updateCredential({ credentialId, updateCredentialRequest: {
        ...draft, evidenceMediaIds: credential.evidenceMediaIds, version } }, csrfHeader(token));
      return valid(saved) ? { state: "saved", record: saved } : { state: "unavailable" };
    } catch (error) {
      if (status(error) === 400 || status(error) === 422) return { state: "invalid" };
      if (status(error) === 404) return { state: "notFound" };
      if (status(error) !== 409) throw error;
    }
    try {
      const latest = await api.getCredential({ credentialId });
      return valid(latest) ? { state: "conflict", latest } : { state: "conflict" };
    } catch (error) {
      if (status(error) === 400 || status(error) === 404) return { state: "notFound" };
      const state = failure(error, validSession);
      return state === "unavailable" ? { state: "conflict" } : { state };
    }
  });
  return result.ok ? result.value : { state: result.state };
}

// Submission only asks for review; a malformed reply is never shown as submitted.
export async function submitForReview(origin: string | null, session: string | undefined, apply: ApplySession,
  credentialId: string, version: number): Promise<SubmitResult> {
  if (!isUuid(credentialId)) return { state: "missing" };
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<SubmitResult> => {
    try {
      const submitted = await new CredentialsApi(configuration).submitCredential(
        { credentialId, submitCredentialRequest: { version } }, csrfHeader(token));
      return valid(submitted) ? { state: "submitted" } : { state: "unavailable" };
    } catch (error) {
      // 409 is a stale version or a credential that is no longer a draft or rejected.
      if (status(error) === 409) return { state: "conflict" };
      if (status(error) === 422) return { state: "evidenceRequired" };
      if (status(error) === 400 || status(error) === 404) return { state: "missing" };
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}

// The API stops delivering the credential's evidence and deletes it.
export async function deleteCredential(origin: string | null, session: string | undefined, apply: ApplySession,
  credentialId: string, version: number): Promise<DeleteResult> {
  if (!isUuid(credentialId)) return { state: "missing" };
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<DeleteResult> => {
    try {
      await new CredentialsApi(configuration).deleteCredential({ credentialId, version }, csrfHeader(token));
      return { state: "removed" };
    } catch (error) {
      if (status(error) === 409) return { state: "conflict" };
      if (status(error) === 400 || status(error) === 404) return { state: "missing" };
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}
