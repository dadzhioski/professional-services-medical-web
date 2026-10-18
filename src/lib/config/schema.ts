export type ServerEnvironment = Readonly<{
  nodeEnv: "development" | "test" | "production";
  apiInternalUrl: string;
  publicOrigin: string;
}>;

// Pure validation only: never read process.env or export secrets here.
export function parseServerEnvironment(input: {
  NODE_ENV?: string;
  API_INTERNAL_URL?: string;
  PUBLIC_ORIGIN?: string;
}): ServerEnvironment {
  const nodeEnv = input.NODE_ENV;
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("Invalid environment: NODE_ENV must be development, test, or production.");
  }

  const value = input.API_INTERNAL_URL;
  let origin: string;
  try {
    if (!value || value !== value.trim() || !/^https?:\/\//i.test(value) ||
        /[\\\s?#]/.test(value)) {
      throw new Error();
    }
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash ||
        !/^https?:\/\/[^/]+\/?$/i.test(value)) {
      throw new Error();
    }
    origin = url.origin;
  } catch {
    throw new Error("Invalid environment: API_INTERNAL_URL must be an HTTP(S) origin without credentials, path, query, or fragment.");
  }
  let publicOrigin: string;
  try {
    const value = input.PUBLIC_ORIGIN;
    if (!value || !/^https?:\/\/[^/]+\/?$/.test(value) || /[\\\s?#]/.test(value)) throw new Error();
    const url = new URL(value);
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/") throw new Error();
    publicOrigin = url.origin;
  } catch {
    throw new Error("Invalid environment: PUBLIC_ORIGIN must be an HTTPS origin (HTTP only on loopback) without credentials, path, query, or fragment.");
  }
  return Object.freeze({ nodeEnv, apiInternalUrl: origin, publicOrigin });
}
