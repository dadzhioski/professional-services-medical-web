import type { ReactNode } from "react";
import { languagePath, localeCodes, locales, translator, type Locale } from "@/lib/i18n";

export function LanguageLinks({ locale, path }: { locale: Locale; path: string }) {
  return <nav aria-label={translator(locale)("navigation.language")} className="flex flex-wrap justify-end gap-x-3 sm:gap-x-4">
    {localeCodes.map(code => <a key={code} href={languagePath(code, path)} hrefLang={code} lang={code}
      aria-current={code === locale ? "page" : undefined}
      className="inline-flex min-h-11 items-center rounded py-2 text-sm text-primary underline underline-offset-4 hover:text-primary-strong aria-[current=page]:font-semibold aria-[current=page]:text-ink">
      {locales[code].name}</a>)}
  </nav>;
}

export function SkipLink({ locale }: { locale: Locale }) {
  return <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-input focus:bg-surface focus:p-4 focus:text-ink focus:shadow-card">
    {translator(locale)("navigation.skipToContent")}</a>;
}

// Canvas text on the ink band is 11.51:1. The band has no focusable content (see globals.css).
export function SiteFooter({ locale }: { locale: Locale }) {
  return <footer className="mt-auto pt-16"><div className="bg-ink text-canvas">
    <div className="mx-auto max-w-3xl px-6 py-10 text-sm leading-relaxed"><p>{translator(locale)("footer.notice")}</p></div>
  </div></footer>;
}

// Operational routes keep the plain title header; localized pages render SiteHeader themselves.
export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <>
    <SkipLink locale={locale} />
    <header className="mb-8 border-b border-border bg-surface"><div className="mx-auto max-w-3xl px-6 py-5">
      <p className="text-xl font-semibold tracking-tight text-ink">{translator(locale)("app.title")}</p>
    </div></header>
    {children}
    <SiteFooter locale={locale} />
  </>;
}
