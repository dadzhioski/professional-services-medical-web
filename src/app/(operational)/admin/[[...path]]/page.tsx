import { notFound, redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

export default async function BareEntry({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (!["","doctors","credentials"].includes(path.join("/"))) notFound();
  redirect(`/${defaultLocale}/admin${path.length ? "/" + path.map(encodeURIComponent).join("/") : ""}`);
}
