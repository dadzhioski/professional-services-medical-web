import { defaultLocale, translator } from "@/lib/i18n";
import { Heading } from "@/components/ui/presentation";

export default function NotFound() {
  const t = translator(defaultLocale);
  return <main id="main-content" tabIndex={-1} lang={defaultLocale} className="mx-auto max-w-3xl space-y-4 px-6">
    <Heading>{t("notFound.heading")}</Heading><p>{t("notFound.description")}</p>
  </main>;
}
