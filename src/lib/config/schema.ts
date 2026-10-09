export type ServerEnvironment = Readonly<{
  nodeEnv: "development" | "test" | "production";
}>;

// Pure validation only: never read process.env or export secrets here.
export function parseServerEnvironment(input: { NODE_ENV?: string }): ServerEnvironment {
  const nodeEnv = input.NODE_ENV;
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("Invalid environment: NODE_ENV must be development, test, or production.");
  }
  return Object.freeze({ nodeEnv });
}
