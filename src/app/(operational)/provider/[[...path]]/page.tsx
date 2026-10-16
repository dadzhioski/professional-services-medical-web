import { notFound, redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

export default async function BareEntry({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (!["","onboarding","profile","services","locations","credentials","publication"].includes(path.join("/"))) notFound();
  redirect(`/${defaultLocale}/provider${path.length ? "/" + path.map(encodeURIComponent).join("/") : ""}`);
}
