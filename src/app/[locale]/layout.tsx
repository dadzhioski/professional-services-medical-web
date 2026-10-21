import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SiteFooter, SkipLink } from "@/components/site-shell";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";
import "../globals.css";

// Pages render the account-aware SiteHeader, so localized output is never static or shared.
export const dynamic = "force-dynamic";
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
  return <html lang={locale}><body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
    <SkipLink locale={locale} />{children}<SiteFooter locale={locale} />
  </body></html>;
}
