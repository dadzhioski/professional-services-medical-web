import { notFound, redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

export default async function BareEntry({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  // Bare /doctors is the directory and /doctors/<slug> a public profile; deeper paths do not exist.
  if (path.length > 1) notFound();
  redirect(`/${defaultLocale}/doctors${path.length ? "/" + path.map(encodeURIComponent).join("/") : ""}`);
}
