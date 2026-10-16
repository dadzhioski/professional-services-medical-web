import type { ReactNode } from "react";
import { languagePath, localeCodes, locales, translator, type Locale } from "@/lib/i18n";

export function LanguageLinks({ locale, path }: { locale: Locale; path: string }) {
  return <nav aria-label={translator(locale)("navigation.language")} className="flex flex-wrap gap-4">
    {localeCodes.map(code => <a key={code} href={languagePath(code, path)} hrefLang={code} lang={code}
      aria-current={code === locale ? "page" : undefined} className="rounded py-2 text-blue-800 underline underline-offset-4">{locales[code].name}</a>)}
  </nav>;
}

export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = translator(locale);
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-white focus:p-4">{t("navigation.skipToContent")}</a>
    <header className="mx-auto max-w-5xl px-6 py-8"><p className="font-semibold text-teal-900">{t("app.title")}</p></header>
    {children}
    <footer className="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-700"><p>{t("footer.notice")}</p></footer>
  </>;
}
