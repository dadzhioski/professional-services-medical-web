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
  return <html lang="en"><body className="flex min-h-screen flex-col bg-canvas text-text antialiased"><SiteShell locale="en">{children}</SiteShell></body></html>;
}
