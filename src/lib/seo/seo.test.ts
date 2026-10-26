import { afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localeCodes } from "@/lib/i18n";
import { canonicalUrl, languageAlternates } from "./canonical";
import { metaDescription, physicianJsonLd, serializeJsonLd } from "./structured-data";

afterEach(() => vi.unstubAllEnvs());

test("canonical and alternate URLs are localized and come only from PUBLIC_ORIGIN", () => {
  vi.stubEnv("PUBLIC_ORIGIN", "https://medical.example.test");
  vi.stubEnv("HOST", "evil.test");
  vi.stubEnv("X_FORWARDED_HOST", "evil.test");
  vi.stubEnv("X_FORWARDED_PROTO", "http");
  for (const locale of localeCodes) {
    expect(canonicalUrl(locale, "/doctors/dr-synthetic")).toBe(`https://medical.example.test/${locale}/doctors/dr-synthetic`);
  }
  expect(languageAlternates("/doctors/dr-synthetic")).toEqual({
    mk: "https://medical.example.test/mk/doctors/dr-synthetic", en: "https://medical.example.test/en/doctors/dr-synthetic",
    bg: "https://medical.example.test/bg/doctors/dr-synthetic", sq: "https://medical.example.test/sq/doctors/dr-synthetic",
    "x-default": "https://medical.example.test/mk/doctors/dr-synthetic" });
});
test("an invalid configured origin fails instead of falling back to request data", () => {
  vi.stubEnv("PUBLIC_ORIGIN", "http://medical.example.test");
  expect(() => canonicalUrl("en", "/doctors/x")).toThrow();
});

test("serialized structured data cannot close the script element or open comments", () => {
  const hostile = `</script><script>alert(1)</script><!-- & ${String.fromCharCode(0x2028, 0x2029)}`;
  const serialized = serializeJsonLd({ name: hostile });
  expect(serialized).not.toMatch(/[<>&]/);
  expect(serialized).not.toContain(String.fromCharCode(0x2028));
  expect(serialized).not.toContain(String.fromCharCode(0x2029));
  expect(JSON.parse(serialized)).toEqual({ name: hostile });
});
test("structured data has only supplied public fields and omits empty groups", () => {
  const minimal = physicianJsonLd({ name: "Synthetic Doctor", url: "https://medical.example.test/en/doctors/x", description: "Synthetic",
    addresses: [], credentials: [] });
  expect(minimal).toEqual({ "@context": "https://schema.org", "@type": "Physician", name: "Synthetic Doctor",
    url: "https://medical.example.test/en/doctors/x", description: "Synthetic" });
  const full = physicianJsonLd({ ...minimal, addresses: [{ street: "Synthetic street 1", locality: "Skopje", country: "MK" }],
    credentials: [{ name: "Synthetic licence", category: "Licence", issuer: "Synthetic board" }] });
  expect(full.address).toEqual([{ "@type": "PostalAddress", streetAddress: "Synthetic street 1", addressLocality: "Skopje", addressCountry: "MK" }]);
  expect(full.hasCredential).toEqual([{ "@type": "EducationalOccupationalCredential", name: "Synthetic licence", credentialCategory: "Licence",
    recognizedBy: { "@type": "Organization", name: "Synthetic board" } }]);
  expect(JSON.stringify(full)).not.toMatch(/rating|review|email|telephone|image|identifier/i);
});
test("meta descriptions collapse whitespace and shorten at a word boundary", () => {
  expect(metaDescription("  Synthetic\n\n biography  ")).toBe("Synthetic biography");
  const long = metaDescription("word ".repeat(60));
  expect(long.length).toBeLessThanOrEqual(160);
  expect(long.endsWith("word…")).toBe(true);
  expect(metaDescription("x".repeat(200))).toHaveLength(160);
});
