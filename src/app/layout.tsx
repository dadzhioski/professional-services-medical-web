import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getServerEnvironment } from "@/lib/config/server";
import { locale, t } from "@/lib/i18n/en";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.title"),
  description: t("app.description"),
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  getServerEnvironment();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-white focus:p-4">
          {t("navigation.skipToContent")}
        </a>
        <header className="mx-auto max-w-3xl px-6 py-8">
          <p className="font-semibold">{t("app.title")}</p>
        </header>
        {children}
        <footer className="mx-auto max-w-3xl px-6 py-8 text-sm text-slate-700">
          <p>{t("footer.notice")}</p>
        </footer>
      </body>
    </html>
  );
}
