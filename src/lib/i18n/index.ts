import { messages as en, type TranslationKey } from "./en";
import { messages as mk } from "./mk";
import { messages as bg } from "./bg";
import { messages as sq } from "./sq";

export const locales = {
  mk: { name: "Македонски", messages: mk },
  en: { name: "English", messages: en },
  bg: { name: "Български", messages: bg },
  sq: { name: "Shqip", messages: sq },
} as const;
export type Locale = keyof typeof locales;
export const defaultLocale: Locale = "mk";
export const localeCodes = Object.keys(locales) as Locale[];
export function isLocale(value: string): value is Locale {
  return Object.hasOwn(locales, value);
}
export function translator(locale: Locale) {
  return (key: TranslationKey): string => locales[locale].messages[key];
}

// Accept application paths only; never preserve query strings or fragments.
export function languagePath(locale: Locale, path: string): string {
  const pathname = path.split(/[?#]/, 1)[0];
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) return `/${locale}`;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLocale(segments[0])) segments.shift();
  return `/${locale}${segments.length ? "/" + segments.join("/") : ""}`;
}
