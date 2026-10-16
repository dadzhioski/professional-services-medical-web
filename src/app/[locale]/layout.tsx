import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";
import "../globals.css";

type Props = { params: Promise<{ locale: string }>; children: ReactNode };
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  return { title: t("app.title"), description: t("app.description"), robots: { index: false, follow: false } };
}
export default async function LocalizedLayout({ params, children }: Props) {
  getServerEnvironment();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <html lang={locale}><body className="min-h-screen bg-slate-50 text-slate-900 antialiased"><SiteShell locale={locale}>{children}</SiteShell></body></html>;
}
