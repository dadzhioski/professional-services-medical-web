export type ServerEnvironment = Readonly<{
  nodeEnv: "development" | "test" | "production";
  apiInternalUrl: string;
}>;

// Pure validation only: never read process.env or export secrets here.
export function parseServerEnvironment(input: {
  NODE_ENV?: string;
  API_INTERNAL_URL?: string;
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
  return Object.freeze({ nodeEnv, apiInternalUrl: origin });
}
