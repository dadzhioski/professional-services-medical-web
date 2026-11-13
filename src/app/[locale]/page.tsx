import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";

// The site starts at the public directory; /[locale] serves no content of its own, so the directory keeps one canonical URL.
export default async function LocalizedEntry({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/doctors`);
}
