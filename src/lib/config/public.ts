// Explicit, empty allowlist: this foundation needs no browser configuration.
// Future NEXT_PUBLIC_* values must be read individually and validated here.
// Never import server.ts or spread process.env into this module.
export type PublicEnvironment = Readonly<Record<string, never>>;
export const publicEnvironment: PublicEnvironment = Object.freeze({});
