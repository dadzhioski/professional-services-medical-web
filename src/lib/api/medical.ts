import "server-only";
import { MedicalApi, ResponseError, type Configuration, type MedicalProfileResponse } from "@dadzhioski/professional-services-api-client";
import { identifier, optionalText, type RecordChange } from "./owned-records";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

export type MedicalResult = { state: "ready"; medical: MedicalProfileResponse } | { state: "missing" } | { state: IdentityState };

function valid(medical: MedicalProfileResponse | null | undefined): medical is MedicalProfileResponse {
  return !!medical && Number.isSafeInteger(medical.version) && optionalText(medical.licenseNumber) &&
    optionalText(medical.registrationBody) && (medical.specialtyId === undefined || medical.specialtyId === null || identifier(medical.specialtyId));
}

async function readWith(configuration: Configuration, session: string): Promise<MedicalResult> {
  try {
    const medical = await new MedicalApi(configuration).getMedicalProfile();
    return valid(medical) ? { state: "ready", medical } : { state: "unavailable" };
  } catch (error) {
    if (error instanceof ResponseError && error.response.status === 404) return { state: "missing" };
    return { state: failure(error, session) };
  }
}

export async function readMedical(session?: string): Promise<MedicalResult> {
  if (!session) return { state: "signedOut" };
  return readWith(sessionConfiguration(session), session);
}

// Only the specialty is edited here. The API replaces licence number and registration body too, so their
// current values are re-read server-side and sent unchanged; they never pass through the browser.
// `version` is undefined when the page showed no medical extension yet.
export async function saveSpecialty(origin: string | null, session: string | undefined, apply: ApplySession,
  specialtyId: string | undefined, version: number | undefined): Promise<RecordChange<MedicalProfileResponse>> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token, validSession): Promise<RecordChange<MedicalProfileResponse>> => {
    const api = new MedicalApi(configuration);
    const init = csrfHeader(token);
    const conflict = async (): Promise<RecordChange<MedicalProfileResponse>> => {
      const latest = await readWith(configuration, validSession);
      if (latest.state === "ready") return { state: "conflict", latest: latest.medical };
      return latest.state === "missing" || latest.state === "unavailable" ? { state: "conflict" } : { state: latest.state };
    };
    try {
      let current = await readWith(configuration, validSession);
      if (current.state === "missing") {
        if (version !== undefined) return { state: "conflict" };
        // Idempotent creation, then edited like any existing extension.
        const created = await api.createOrGetMedicalProfile(init);
        if (!valid(created)) return { state: "unavailable" };
        current = { state: "ready", medical: created };
        version = created.version;
      }
      if (current.state !== "ready") return { state: current.state };
      // Another tab created the extension after this page was rendered.
      if (version === undefined) return { state: "conflict", latest: current.medical };
      const saved = await api.editMedicalProfile({ editMedicalRequest: {
        licenseNumber: current.medical.licenseNumber ?? undefined, registrationBody: current.medical.registrationBody ?? undefined,
        specialtyId, version,
      } }, init);
      return valid(saved) ? { state: "saved", record: saved } : { state: "unavailable" };
    } catch (error) {
      if (!(error instanceof ResponseError)) return { state: "unavailable" };
      if (error.response.status === 400) return { state: "invalid" };
      if (error.response.status === 409) return conflict();
      throw error;
    }
  });
  return result.ok ? result.value : { state: result.state };
}
