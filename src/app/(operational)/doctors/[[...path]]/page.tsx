import { notFound, redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

export default async function BareEntry({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (path.length !== 1) notFound();
  redirect(`/${defaultLocale}/doctors${path.length ? "/" + path.map(encodeURIComponent).join("/") : ""}`);
}
