import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { localeCodes } from "@/lib/i18n";
import Page from "./page";

const visit = (locale: string) => Page({ params: Promise.resolve({ locale }) }).then(() => "none", (error: Error) => error.message);

test.each(localeCodes)("%s old credential links land on the profile qualifications section", async locale => {
  expect(await visit(locale)).toBe(`redirect:/${locale}/provider/profile#qualifications`);
});
test("unsupported locales are not found", async () => {
  expect(await visit("xx")).toBe("not-found");
});
