import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getServerEnvironment } from "@/lib/config/server";
import { SiteShell } from "@/components/site-shell";
import { t } from "@/lib/i18n/en";
import "../globals.css";

export const metadata: Metadata = {
  title: t("app.title"), description: t("app.description"), robots: { index: false, follow: false },
};
export default function OperationalLayout({ children }: { children: ReactNode }) {
  getServerEnvironment();
  return <html lang="en"><body className="min-h-screen bg-slate-50 text-slate-900 antialiased"><SiteShell locale="en">{children}</SiteShell></body></html>;
}
