import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("redirect"), { url }); },
  notFound: () => { throw new Error("notFound"); },
}));
import { localeCodes } from "@/lib/i18n";
import Page from "./page";

// The page only redirects; the thrown target stands in for Next.js's redirect response.
const target = async (locale: string, searchParams: Record<string, string | undefined> = {}) => {
  try {
    await Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(searchParams) });
  } catch (error) { return (error as { url?: string; message: string }).url ?? (error as Error).message; }
  return "rendered";
};

test.each(localeCodes)("%s workspace path lands on the checklist (login return, header and entry page)", async locale => {
  expect(await target(locale)).toBe(`/${locale}/provider/onboarding`);
});
test.each([["notice", "forbidden"], ["notice", "unavailable"], ["notice", "expired"], ["approval", "resubmitted"],
  ["approval", "conflict"], ["approval", "invalid"]])("known %s=%s is carried to the checklist", async (name, value) => {
  expect(await target("mk", { [name]: value })).toBe(`/mk/provider/onboarding?${name}=${value}`);
});
test("both known values are carried together", async () => {
  expect(await target("en", { notice: "expired", approval: "conflict" })).toBe("/en/provider/onboarding?notice=expired&approval=conflict");
});
test.each([{ notice: "signedOut" }, { notice: "raw-private-error" }, { approval: "constructor" }, { approval: "<script>" },
  { token: "private" }])("unknown query %j is dropped", async query => {
  expect(await target("en", query)).toBe("/en/provider/onboarding");
});
test("unsupported locales are not found", async () => {
  expect(await target("fr")).toBe("notFound");
});
