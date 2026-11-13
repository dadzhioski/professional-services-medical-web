import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { expect, test, vi } from "vitest";
import { t } from "@/lib/i18n/en";

vi.mock("server-only", () => ({}));
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`redirect:${url}`); }));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("not-found"); }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
import RootLayout from "./(operational)/layout";
import Entry from "./(operational)/page";
import LocalizedEntry from "./[locale]/page";

const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

test("the site starts at the localized doctor directory", async () => {
  expect(() => Entry()).toThrow("redirect:/mk/doctors");
  for (const locale of ["mk", "en", "bg", "sq"]) {
    await expect(LocalizedEntry(params(locale))).rejects.toThrow(`redirect:/${locale}/doctors`);
  }
});

test("an unknown locale is not found and never redirects", async () => {
  await expect(LocalizedEntry(params("fr"))).rejects.toThrow("not-found");
  expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining("/fr"));
});

test("operational document renders without JavaScript and passes structural accessibility checks", async () => {
  const html = renderToStaticMarkup(<RootLayout><main id="main-content" tabIndex={-1}><h1>{t("systemStatus.heading")}</h1></main></RootLayout>);
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  documentNode.title = t("app.title");
  expect(documentNode.documentElement.lang).toBe("en");
  expect(documentNode.querySelector('a[href="#main-content"]')?.textContent).toBe(t("navigation.skipToContent"));
  expect(documentNode.querySelector("header")).not.toBeNull();
  expect(documentNode.querySelector("footer")).not.toBeNull();
  expect(t("footer.notice")).not.toMatch(/development/i);
  document.documentElement.lang = documentNode.documentElement.lang;
  document.title = documentNode.title;
  document.body.innerHTML = documentNode.body.innerHTML;
  const results = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations).toEqual([]);
  document.body.innerHTML = "";
});
