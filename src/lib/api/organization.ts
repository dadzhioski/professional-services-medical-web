import "server-only";
import { OrganizationApi, ResponseError, type Configuration, type ContextResponse } from "@dadzhioski/professional-services-api-client";
import { csrfHeader, csrfMutation, failure, sessionConfiguration, type ApplySession, type IdentityState } from "./session-transport";

export type ContextResult = { state: "ready"; context: ContextResponse } | { state: "notOnboarded" } | { state: IdentityState };

// The API derives organization and membership from the session; callers never supply them.
async function readContext(configuration: Configuration, session: string): Promise<ContextResult> {
  try {
    const context = await new OrganizationApi(configuration).getCurrentContext();
    if (!context || typeof context.organizationId !== "string" || !context.organizationId ||
        typeof context.approvalState !== "string" || typeof context.suspended !== "boolean") return { state: "unavailable" };
    return { state: "ready", context };
  } catch (error) {
    if (error instanceof ResponseError && error.response.status === 404) return { state: "notOnboarded" };
    return { state: failure(error, session) };
  }
}

export async function currentContext(session?: string): Promise<ContextResult> {
  if (!session) return { state: "signedOut" };
  return readContext(sessionConfiguration(session), session);
}

export async function onboardWorkspace(origin: string | null, session: string | undefined,
  apply: ApplySession): Promise<"ready" | IdentityState> {
  const result = await csrfMutation(origin, session, apply, async (configuration, token, validSession): Promise<"ready" | IdentityState> => {
    try {
      const onboarding = await new OrganizationApi(configuration).onboard(csrfHeader(token));
      if (onboarding && typeof onboarding.organizationId === "string" && onboarding.organizationId &&
          typeof onboarding.approvalState === "string") return "ready";
    } catch (error) {
      if (error instanceof ResponseError && [401, 403].includes(error.response.status)) throw error;
    }
    // The outcome is ambiguous; only the API's current context can show that the workspace exists.
    const context = await readContext(configuration, validSession);
    if (context.state === "ready") return "ready";
    return context.state === "notOnboarded" ? "unavailable" : context.state;
  });
  return result.ok ? result.value : result.state;
}
