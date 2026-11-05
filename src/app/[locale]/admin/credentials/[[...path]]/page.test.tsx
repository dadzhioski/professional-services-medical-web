import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { localeCodes } from "@/lib/i18n";
import Page from "./page";

const visit = (locale: string) => Page({ params: Promise.resolve({ locale, path: ["6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d"] }) }).then(() => "none", (error: Error) => error.message);

test.each(localeCodes)("%s old credential review links land on the doctor applications", async locale => {
  expect(await visit(locale)).toBe(`redirect:/${locale}/admin/doctors`);
});
test("unsupported locales are not found", async () => {
  expect(await visit("xx")).toBe("not-found");
});
