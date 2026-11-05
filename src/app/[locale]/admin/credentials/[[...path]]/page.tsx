import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";

// WEB-M1-016: qualifications are reviewed with the doctor's approval; the separate credential queue is gone.
export default async function CredentialReviewMoved({ params }: { params: Promise<{ locale: string; path?: string[] }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/admin/doctors`);
}
