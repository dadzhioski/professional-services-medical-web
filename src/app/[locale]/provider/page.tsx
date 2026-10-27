import { notFound, redirect } from "next/navigation";
import { approvalOutcomes } from "@/features/provider-publication/labels";
import { checklistPath } from "@/features/provider-onboarding/workspace";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; approval?: string }> };

// The login return path stays /[locale]/provider (API allowlist); the checklist is the provider landing page.
// Only known notice and approval values are carried over; anything else in the query is dropped.
export default async function ProviderPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { notice, approval } = await searchParams;
  const query = new URLSearchParams();
  if (notice === "forbidden" || notice === "unavailable" || notice === "expired") query.set("notice", notice);
  if (typeof approval === "string" && Object.hasOwn(approvalOutcomes, approval)) query.set("approval", approval);
  redirect(`${checklistPath(locale)}${query.size ? `?${query}` : ""}`);
}
