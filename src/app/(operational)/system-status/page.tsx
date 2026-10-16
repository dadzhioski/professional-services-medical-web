import type { Metadata } from "next";
import { Surface } from "@/components/ui/surface";
import { getSystemStatus } from "@/lib/api/system-status";
import { t } from "@/lib/i18n/en";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: t("systemStatus.heading"),
  robots: { index: false, follow: false },
};

export default async function SystemStatusPage() {
  const result = await getSystemStatus();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl px-6">
      <Surface>
        <h1 className="text-3xl font-bold tracking-tight">{t("systemStatus.heading")}</h1>
        {result.available ? (
          <dl className="mt-6 space-y-4">
            <div>
              <dt className="font-semibold">{t("systemStatus.service")}</dt>
              <dd className="mt-1 break-words text-slate-700">{result.data.service}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("systemStatus.version")}</dt>
              <dd className="mt-1 break-words text-slate-700">{result.data.version}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("systemStatus.status")}</dt>
              <dd className="mt-1 text-slate-700">{t("systemStatus.up")}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-6 text-slate-700">{t("systemStatus.unavailable")}</p>
        )}
      </Surface>
    </main>
  );
}
