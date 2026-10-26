import "server-only";
import { CredentialReviewApi, CredentialReviewResponseStateEnum, DoctorReviewApi, DoctorReviewResponseApprovalStateEnum,
  ResponseError, type Configuration, type CredentialReviewResponse, type DoctorReviewResponse, type ProfileResponse } from "@dadzhioski/professional-services-api-client";
import { isUuid } from "./media";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

// Administrator access is decided by the API alone: a 403 on any call below is the denied state.
export type ApprovalState = (typeof DoctorReviewResponseApprovalStateEnum)[keyof typeof DoctorReviewResponseApprovalStateEnum];
export const approvalStates: readonly ApprovalState[] = Object.values(DoctorReviewResponseApprovalStateEnum);
export type DoctorsResult = { state: "ready"; doctors: DoctorReviewResponse[] } | { state: IdentityState };
export type DoctorResult = { state: "ready"; doctor: DoctorReviewResponse; profile?: ProfileResponse } | { state: "notFound" } |
  { state: IdentityState };
export type ReviewCredential = CredentialReviewResponse & Required<Pick<CredentialReviewResponse, "credentialId" | "organizationId" |
  "revision" | "state" | "type" | "title" | "issuer" | "issuedOn" | "evidenceMediaIds">>;
export type CredentialsResult = { state: "ready"; credentials: ReviewCredential[] } | { state: IdentityState };
export type CredentialResult = { state: "ready"; credential: ReviewCredential } | { state: "notFound" } | { state: IdentityState };
export type DoctorDecision = "approve" | "suspend" | "reinstate";
export type DecisionResult = { state: "decided" | "conflict" | "missing" | "invalid" | IdentityState };

const validDate = (value: unknown) => value instanceof Date && !Number.isNaN(value.getTime());
const optionalText = (value: unknown) => value === undefined || value === null || typeof value === "string";
const status = (error: unknown) => error instanceof ResponseError ? error.response.status : undefined;

function validDoctor(doctor: DoctorReviewResponse | null | undefined): doctor is DoctorReviewResponse {
  return !!doctor && isUuid(doctor.organizationId) && Number.isSafeInteger(doctor.revision) &&
    typeof doctor.suspended === "boolean" && approvalStates.includes(doctor.approvalState) && validDate(doctor.registeredAt);
}

function validProfile(profile: ProfileResponse | null | undefined): profile is ProfileResponse {
  return !!profile && optionalText(profile.displayName) && optionalText(profile.biography) && optionalText(profile.publicationState);
}

const credentialStates: readonly string[] = Object.values(CredentialReviewResponseStateEnum);

// Every field the reviewer sees is required; evidence identifiers must be UUIDs before any image path is built.
function validCredential(credential: CredentialReviewResponse | null | undefined): credential is ReviewCredential {
  if (!credential || !isUuid(credential.credentialId) || !isUuid(credential.organizationId) ||
      !Number.isSafeInteger(credential.revision)) return false;
  const evidence = credential.evidenceMediaIds ?? [];
  if (!Array.isArray(evidence) || !evidence.every(isUuid)) return false;
  credential.evidenceMediaIds = evidence;
  return typeof credential.state === "string" && credentialStates.includes(credential.state) && typeof credential.type === "string" &&
    typeof credential.title === "string" && typeof credential.issuer === "string" && validDate(credential.issuedOn) &&
    (credential.expiresOn === undefined || credential.expiresOn === null || validDate(credential.expiresOn)) &&
    (credential.submittedAt === undefined || credential.submittedAt === null || validDate(credential.submittedAt));
}

export async function doctorsForReview(session: string | undefined, approvalState: ApprovalState): Promise<DoctorsResult> {
  if (!session) return { state: "signedOut" };
  try {
    const doctors = await new DoctorReviewApi(sessionConfiguration(session)).listDoctorsForReview({ approvalState });
    return Array.isArray(doctors) && doctors.every(validDoctor) ? { state: "ready", doctors } : { state: "unavailable" };
  } catch (error) { return { state: failure(error, session) }; }
}

// The contract has no single-doctor review read, so the decision revision comes from the approval-state lists.
export async function doctorForReview(session: string | undefined, organizationId: string): Promise<DoctorResult> {
  if (!session) return { state: "signedOut" };
  if (!isUuid(organizationId)) return { state: "notFound" };
  const lists = await Promise.all(approvalStates.map(state => doctorsForReview(session, state)));
  const failed = lists.find(list => list.state !== "ready");
  if (failed) return { state: failed.state as IdentityState };
  const doctor = lists.flatMap(list => list.state === "ready" ? list.doctors : []).find(item => item.organizationId === organizationId);
  if (!doctor) return { state: "notFound" };
  try {
    const profile = await new DoctorReviewApi(sessionConfiguration(session)).getDoctorProfileForReview({ organizationId });
    return validProfile(profile) ? { state: "ready", doctor, profile } : { state: "unavailable" };
  } catch (error) {
    // A doctor who has not started a profile is still reviewable.
    if (status(error) === 404) return { state: "ready", doctor };
    return { state: failure(error, session) };
  }
}

export async function submittedCredentials(session?: string): Promise<CredentialsResult> {
  if (!session) return { state: "signedOut" };
  try {
    const credentials = await new CredentialReviewApi(sessionConfiguration(session)).listSubmittedCredentials();
    return Array.isArray(credentials) && credentials.every(validCredential) ? { state: "ready", credentials } : { state: "unavailable" };
  } catch (error) { return { state: failure(error, session) }; }
}

export async function credentialForReview(session: string | undefined, credentialId: string): Promise<CredentialResult> {
  if (!session) return { state: "signedOut" };
  if (!isUuid(credentialId)) return { state: "notFound" };
  try {
    const credential = await new CredentialReviewApi(sessionConfiguration(session)).getCredentialForReview({ credentialId });
    return validCredential(credential) ? { state: "ready", credential } : { state: "unavailable" };
  } catch (error) {
    if (status(error) === 400 || status(error) === 404) return { state: "notFound" };
    return { state: failure(error, session) };
  }
}

// Each decision carries the revision the administrator reviewed. A 409 is never retried: the page reloads for a new review.
async function decide<T>(origin: string | null, session: string | undefined, apply: ApplySession, id: string,
  call: (configuration: Configuration, token: string) => Promise<T>, valid: (value: T) => boolean): Promise<DecisionResult> {
  if (!isUuid(id)) return { state: "missing" };
  const result = await csrfMutation(origin, session, apply, async (configuration, token): Promise<DecisionResult> => {
    try {
      return valid(await call(configuration, token)) ? { state: "decided" } : { state: "unavailable" };
    } catch (error) {
      if (status(error) === 409) return { state: "conflict" };
      if (status(error) === 400 || status(error) === 422) return { state: "invalid" };
      if (status(error) === 404) return { state: "missing" };
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}

export function decideDoctor(origin: string | null, session: string | undefined, apply: ApplySession, organizationId: string,
  decision: DoctorDecision, revision: number): Promise<DecisionResult> {
  return decide(origin, session, apply, organizationId, (configuration, token) => {
    const api = new DoctorReviewApi(configuration);
    const request = { organizationId, doctorDecisionRequest: { revision } };
    if (decision === "approve") return api.approveDoctor(request, csrfHeader(token));
    if (decision === "suspend") return api.suspendDoctor(request, csrfHeader(token));
    return api.reinstateDoctor(request, csrfHeader(token));
  }, validDoctor);
}

export function rejectDoctor(origin: string | null, session: string | undefined, apply: ApplySession, organizationId: string,
  revision: number, reason: string): Promise<DecisionResult> {
  return decide(origin, session, apply, organizationId, (configuration, token) => new DoctorReviewApi(configuration).rejectDoctor(
    { organizationId, rejectDoctorRequest: { reason, revision } }, csrfHeader(token)), validDoctor);
}

export function approveCredential(origin: string | null, session: string | undefined, apply: ApplySession, credentialId: string,
  revision: number): Promise<DecisionResult> {
  return decide(origin, session, apply, credentialId, (configuration, token) => new CredentialReviewApi(configuration).approveCredential(
    { credentialId, reviewDecisionRequest: { revision } }, csrfHeader(token)), validCredential);
}

export function rejectCredential(origin: string | null, session: string | undefined, apply: ApplySession, credentialId: string,
  revision: number, reason: string): Promise<DecisionResult> {
  return decide(origin, session, apply, credentialId, (configuration, token) => new CredentialReviewApi(configuration).rejectCredential(
    { credentialId, rejectCredentialRequest: { reason, revision } }, csrfHeader(token)), validCredential);
}
