import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SystemStatusStatusEnum } from "@dadzhioski/professional-services-api-client";
import { t } from "@/lib/i18n/en";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/system-status", () => ({ getSystemStatus: vi.fn() }));
import { getSystemStatus } from "@/lib/api/system-status";
import SystemStatusPage, { dynamic, metadata } from "./page";

beforeEach(() => vi.mocked(getSystemStatus).mockReset());
afterEach(() => { document.body.innerHTML = ""; });

test("renders service, version, and translated status in server HTML", async () => {
  vi.mocked(getSystemStatus).mockResolvedValue({
    available: true, data: { service: "synthetic-api", version: "0.2.0", status: SystemStatusStatusEnum.Up },
  });
  const page = await SystemStatusPage();
  const html = renderToStaticMarkup(page);
  expect(html).toContain("synthetic-api");
  expect(html).toContain("0.2.0");
  expect(html).toContain(t("systemStatus.up"));
  render(page);
  expect(screen.getByRole("heading", { level: 1, name: t("systemStatus.heading") })).toBeVisible();
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  expect(document.querySelectorAll("dt")).toHaveLength(3);
  expect(document.querySelectorAll("dd")).toHaveLength(3);
  expect(dynamic).toBe("force-dynamic");
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect((await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
});

test("renders a safe unavailable message in server HTML without partial fields", async () => {
  vi.mocked(getSystemStatus).mockResolvedValue({ available: false });
  const page = await SystemStatusPage();
  const html = renderToStaticMarkup(page);
  expect(html).toContain(t("systemStatus.unavailable"));
  expect(html).not.toMatch(/api\.example|stack|ResponseError|synthetic-secret/);
  render(page);
  expect(document.querySelector("dl")).toBeNull();
  expect(screen.getByText(t("systemStatus.unavailable"))).toBeVisible();
  expect((await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
});
