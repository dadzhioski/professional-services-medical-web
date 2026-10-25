/* eslint-disable @next/next/no-head-element -- Standalone test document, not a Next route. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { SiteShell, LanguageLinks } from "../../src/components/site-shell";
import { ProfilePresentation } from "../../src/features/professional-profile/presentation";
import { Button, Field, Notice } from "../../src/components/ui/presentation";
import { localeCodes, translator, type Locale } from "../../src/lib/i18n";

const require = createRequire(resolve("package.json"));
const variants = ["complete", "long", "missing-photo", "empty", "field-error"] as const;

function fixture(locale: Locale, variant: typeof variants[number]) {
  const t = translator(locale);
  const long = variant === "long" ? "SyntheticLongContent".repeat(40) : "Synthetic professional";
  const empty = variant === "empty";
  return <html lang={locale}><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{t("app.title")}</title></head>
    <body className="min-h-screen bg-slate-50 text-slate-900 antialiased"><SiteShell locale={locale}>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl space-y-6 px-6">
        <LanguageLinks locale={locale} path={`/${locale}/doctors/synthetic-example?token=private`} />
        <Notice>{t("preview.notice")}</Notice>
        <ProfilePresentation locale={locale} name={long} introduction={empty ? undefined : "Synthetic introduction"}
          specialties={empty ? [] : [long]} credentials={empty ? [" "] : ["Synthetic qualification"]}
          services={empty ? [] : ["Synthetic service"]} locations={empty ? [] : ["Synthetic location"]}
          photo={variant === "complete" ? <svg role="img" aria-label="Synthetic portrait" viewBox="0 0 128 128"><rect width="128" height="128" fill="#ccfbf1" /><circle cx="64" cy="48" r="24" fill="#115e59" /><path d="M16 128a48 48 0 0 1 96 0" fill="#115e59" /></svg> : undefined} />
        {variant === "field-error" && <form><Field id="professional-name" label={t("form.professionalName")} hint={t("form.nameHint")} error={t("form.nameRequired")} required /><Button>{t("form.save")}</Button></form>}
      </main>
    </SiteShell></body></html>;
}

for (const locale of localeCodes) {
  test(`localized SSR and language navigation: ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const response = await page.goto(`http://127.0.0.1:4310/${locale}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page).toHaveTitle(translator(locale)("app.title"));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(translator(locale)("home.heading"));
      for (const target of localeCodes) await expect(page.locator(`a[hreflang="${target}"]`)).toHaveAttribute("href", `/${target}`);
    } finally { await context.close(); }
  });
  for (const variant of variants) {
    test(`profile fixture ${locale}: ${variant}`, async ({ page, request }) => {
      const entry = await request.get(`/${locale}`);
      const styles = (await entry.text()).match(/<link[^>]+rel="stylesheet"[^>]*>/g) ?? [];
      expect(styles.length).toBeGreaterThan(0);
      const html = "<!doctype html>" + renderToStaticMarkup(fixture(locale, variant)).replace("</head>", styles.join("") + "</head>");
      await page.route("**/presentation-fixture", route => route.fulfill({ contentType: "text/html", body: html }));
      const response = await page.goto("/presentation-fixture");
      expect(await response!.text()).toContain("Synthetic");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: translator(locale)("navigation.skipToContent") })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      for (const target of localeCodes) await expect(page.locator(`a[hreflang="${target}"]`)).toHaveAttribute("href", `/${target}/doctors/synthetic-example`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (variant === "empty") await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
      if (variant === "missing-photo") await expect(page.getByRole("img")).toHaveCount(0);
      if (variant === "field-error") {
        await expect(page.getByLabel(translator(locale)("form.professionalName"))).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByLabel(translator(locale)("form.professionalName"))).toHaveAccessibleDescription(`${translator(locale)("form.nameHint")} ${translator(locale)("form.nameRequired")}`);
      }
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }).axe.run()).violations);
      expect(violations).toEqual([]);
      const context = await page.context().browser()!.newContext({ javaScriptEnabled: false, viewport: page.viewportSize()! });
      try {
        const noJs = await context.newPage();
        await noJs.route("**/presentation-fixture", route => route.fulfill({ contentType: "text/html", body: html }));
        await noJs.goto("http://127.0.0.1:4310/presentation-fixture");
        await expect(noJs.getByRole("heading", { level: 1 })).toContainText("Synthetic");
        if (variant !== "empty") await expect(noJs.getByText("Synthetic qualification", { exact: true })).toBeVisible();
      } finally { await context.close(); }
    });
  }
}

test("default redirects, unavailable features, unsupported locales and no shipped fixtures", async ({ request }) => {
  for (const path of ["/", "/provider", "/provider/onboarding", "/provider/profile", "/provider/services", "/provider/locations", "/provider/credentials", "/provider/publication", "/admin", "/admin/doctors", "/admin/credentials", "/doctors/stable-slug"]) {
    const response = await request.get(path + "?token=private", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/mk" + (path === "/" ? "" : path));
  }
  for (const path of ["/fr", "/fr/doctors/example", "/en/doctors/synthetic-example", "/mk/provider/publication", "/presentation-fixture"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("Synthetic qualification");
  }
});
