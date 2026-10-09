import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { expect, test, vi } from "vitest";
import Home from "./page";
import { t } from "@/lib/i18n/en";

vi.mock("server-only", () => ({}));
import RootLayout from "./layout";

test("home has one heading and a focusable main landmark", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: t("home.heading") })).toBeVisible();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
});

test("full document renders without JavaScript and passes structural accessibility checks", async () => {
  const html = renderToStaticMarkup(<RootLayout><Home /></RootLayout>);
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  documentNode.title = t("app.title");
  expect(documentNode.documentElement.lang).toBe("en");
  expect(documentNode.querySelector("main")?.textContent).toContain(t("home.heading"));
  expect(documentNode.querySelector('a[href="#main-content"]')?.textContent).toBe(t("navigation.skipToContent"));
  expect(documentNode.querySelector("header")).not.toBeNull();
  expect(documentNode.querySelector("footer")).not.toBeNull();
  document.documentElement.lang = documentNode.documentElement.lang;
  document.title = documentNode.title;
  document.body.innerHTML = documentNode.body.innerHTML;
  const results = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations).toEqual([]);
  document.body.innerHTML = "";
});
