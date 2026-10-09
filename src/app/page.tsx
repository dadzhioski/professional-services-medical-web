import { Surface } from "@/components/ui/surface";
import { t } from "@/lib/i18n/en";

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl px-6">
      <Surface>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("home.heading")}</h1>
        <p className="mt-4 leading-relaxed text-slate-700">{t("home.description")}</p>
        <p className="mt-6 font-medium text-slate-800">{t("home.status")}</p>
      </Surface>
    </main>
  );
}
