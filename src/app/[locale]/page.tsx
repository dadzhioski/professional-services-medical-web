import { notFound } from "next/navigation";
import Home from "@/components/home";
import { isLocale } from "@/lib/i18n";

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Home locale={locale} />;
}
