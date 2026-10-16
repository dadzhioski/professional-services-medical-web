import { describe, expect, test } from "vitest";
import { messages } from "./en";
import { defaultLocale, isLocale, languagePath, localeCodes, locales, translator } from "./index";

describe("build-time locales", () => {
  test("default and every enabled dictionary are complete", () => {
    expect(defaultLocale).toBe("mk");
    for (const locale of localeCodes) {
      expect(Object.keys(locales[locale].messages).sort()).toEqual(Object.keys(messages).sort());
      expect(Object.values(locales[locale].messages).every(value => value.trim())).toBe(true);
      expect(translator(locale)("navigation.language")).toBeTruthy();
    }
    expect(isLocale("constructor")).toBe(false);
    expect(isLocale("fr")).toBe(false);
  });
  test("language paths retain pages and stable slugs, discarding sensitive parameters", () => {
    for (const locale of localeCodes) {
      expect(languagePath(locale, "/en/doctors/stable-slug?token=private#secret")).toBe(`/${locale}/doctors/stable-slug`);
      expect(languagePath(locale, "/mk/provider/profile")).toBe(`/${locale}/provider/profile`);
      expect(languagePath(locale, "/")).toBe(`/${locale}`);
      expect(languagePath(locale, "//example.com")).toBe(`/${locale}`);
      expect(languagePath(locale, "https://example.com")).toBe(`/${locale}`);
    }
  });
});
