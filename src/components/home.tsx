import { Surface } from "@/components/ui/surface";
import { translator, type Locale } from "@/lib/i18n";
import { LanguageLinks } from "@/components/site-shell";
import { Heading } from "@/components/ui/presentation";

export default function Home({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl px-6">
      <LanguageLinks locale={locale} path={`/${locale}`} />
      <Surface>
        <Heading>{t("home.heading")}</Heading>
        <p className="mt-4 leading-relaxed text-slate-700">{t("home.description")}</p>
        <p className="mt-6 font-medium text-slate-800">{t("home.status")}</p>
      </Surface>
    </main>
  );
}
