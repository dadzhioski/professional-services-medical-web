import "server-only";
import { getServerEnvironment } from "@/lib/config/server";
import { defaultLocale, localeCodes, type Locale } from "@/lib/i18n";

// Canonical authority comes only from the validated PUBLIC_ORIGIN, never from Host or forwarded headers.
export function canonicalUrl(locale: Locale, path: string): string {
  return new URL(`/${locale}${path}`, getServerEnvironment().publicOrigin).href;
}

export function languageAlternates(path: string): Record<string, string> {
  return { ...Object.fromEntries(localeCodes.map(code => [code, canonicalUrl(code, path)])),
    "x-default": canonicalUrl(defaultLocale, path) };
}
