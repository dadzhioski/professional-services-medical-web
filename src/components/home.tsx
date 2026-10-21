import { Surface } from "@/components/ui/surface";
import { translator, type Locale } from "@/lib/i18n";
import { LanguageLinks } from "@/components/site-shell";
import { Heading, Section } from "@/components/ui/presentation";

const linkClass = "inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900";

// Neutral entry content until the owner records the patient-facing copy (WEB-M1-013 decision 2).
export default function Home({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
      <LanguageLinks locale={locale} path={`/${locale}`} />
      <Surface>
        <Heading>{t("home.heading")}</Heading>
        <p className="mt-4 leading-relaxed text-slate-700">{t("home.description")}</p>
      </Surface>
      <Section id="home-doctors" title={t("home.doctorsHeading")}>
        <p className="leading-relaxed text-slate-700">{t("home.doctorsDescription")}</p>
        <a className={linkClass} href={`/${locale}/provider`}>{t("home.doctorsAction")}</a>
      </Section>
    </main>
  );
}
