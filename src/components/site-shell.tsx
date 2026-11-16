import type { ReactNode } from "react";
import { pageContainerClass, pillGroupClass, pillLinkClass } from "@/components/ui/presentation";
import { languagePath, localeCodes, locales, translator, type Locale } from "@/lib/i18n";

// A compact pill group (WEB-M2-009 decision 3) that stays plain hreflang links, so it works without JavaScript.
export function LanguageLinks({ locale, path }: { locale: Locale; path: string }) {
  return <nav aria-label={translator(locale)("navigation.language")} className="flex justify-end">
    <ul className={pillGroupClass}>
      {localeCodes.map(code => <li key={code}><a href={languagePath(code, path)} hrefLang={code} lang={code}
        aria-current={code === locale ? "page" : undefined}
        className={`${pillLinkClass} text-sm`}>
        {locales[code].name}</a></li>)}
    </ul>
  </nav>;
}

export function SkipLink({ locale }: { locale: Locale }) {
  return <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-input focus:bg-surface focus:p-4 focus:text-ink focus:shadow-card">
    {translator(locale)("navigation.skipToContent")}</a>;
}

// Decorative "+" mark beside the wordmark (WEB-M2-009 decision 3); the wordmark text stays the accessible name.
export function LogoMark() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" className="size-8 shrink-0">
    <rect width="32" height="32" rx="9" className="fill-primary" />
    <path d="M16 9v14M9 16h14" strokeWidth="3.5" strokeLinecap="round" className="stroke-white" />
  </svg>;
}

// Canvas text on the ink band is 11.51:1. The band has no focusable content (see globals.css).
export function SiteFooter({ locale }: { locale: Locale }) {
  return <footer className="mt-auto pt-16"><div className="bg-ink text-canvas">
    <div className={`${pageContainerClass} py-10 text-sm leading-relaxed`}><p>{translator(locale)("footer.notice")}</p></div>
  </div></footer>;
}

// Operational routes keep the plain title header; localized pages render SiteHeader themselves.
export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <>
    <SkipLink locale={locale} />
    <header className="mb-8 border-b border-border bg-surface"><div className={`${pageContainerClass} py-5`}>
      <p className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink"><LogoMark />{translator(locale)("app.title")}</p>
    </div></header>
    {children}
    <SiteFooter locale={locale} />
  </>;
}
