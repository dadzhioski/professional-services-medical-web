import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";

// WEB-M1-016: qualifications moved to the profile page; old links land on that section.
export default async function CredentialsMoved({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/provider/profile#qualifications`);
}
