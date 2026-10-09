import "server-only";
import {
  Configuration,
  SystemApi,
  SystemStatusStatusEnum,
  type SystemStatus,
} from "@dadzhioski/professional-services-api-client";
import { getServerEnvironment } from "@/lib/config/server";

export type SystemStatusResult =
  | { available: true; data: Required<SystemStatus> }
  | { available: false };

function isCompleteStatus(value: SystemStatus | null): value is Required<SystemStatus> {
  return value !== null &&
    typeof value === "object" &&
    typeof value.service === "string" && value.service.trim().length > 0 &&
    typeof value.version === "string" && value.version.trim().length > 0 &&
    value.status === SystemStatusStatusEnum.Up;
}

export async function getSystemStatus(): Promise<SystemStatusResult> {
  // Configuration errors are fatal, not silently treated as API outages.
  const { apiInternalUrl } = getServerEnvironment();
  const api = new SystemApi(new Configuration({ basePath: apiInternalUrl }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const data = await api.getSystemStatus({
      cache: "no-store",
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
    });
    return isCompleteStatus(data) ? { available: true, data } : { available: false };
  } catch {
    // Never expose or log the URL, response body, or raw dependency error.
    return { available: false };
  } finally {
    clearTimeout(timeout);
  }
}
