import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceCurrencyEnum } from "@dadzhioski/professional-services-api-client";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { recordMessageKeys, recordNotice, type RecordMessages } from "@/features/provider-records/form";
import { actionLinkClass, ProviderFrame, providerGate, PublicationStatus, RecordNoticeView, SignedOutView } from "@/features/provider-records/page-frame";
import { savePriceList } from "@/features/provider-services/actions";
import { blankRows, serviceMessageKeys, type ServiceMessages } from "@/features/provider-services/fields";
import { rowOf } from "@/features/provider-services/plan";
import { PriceListEditor } from "@/features/provider-services/price-list-editor";
import { readProfile } from "@/lib/api/profile";
import { listServices } from "@/lib/api/services";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> };
const currencies = Object.values(PriceCurrencyEnum);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("providerServices.heading"), description: translator(locale)("providerServices.description"),
    robots: { index: false, follow: false } };
}

export default async function ServicesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/provider/services`;
  const gate = await providerGate(locale);
  if (gate.state !== "authenticated") {
    return <SignedOutView locale={locale} path={path} heading="providerServices.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const { session, workspace, loginHref } = gate;
  const ready = workspace.state === "ready";
  const [services, profile] = ready ? await Promise.all([listServices(session), readProfile(session)]) : [];
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    services && services.state !== "ready" ? services.state : undefined;
  const records = services?.state === "ready" ? services.records : undefined;
  const notice = recordNotice((await searchParams).notice);
  const messages = Object.fromEntries(serviceMessageKeys.map(key => [key, t(key)])) as ServiceMessages;
  const recordMessages = Object.fromEntries(recordMessageKeys.map(key => [key, t(key)])) as RecordMessages;
  // New rows use the currency the list already uses; denars otherwise.
  const defaultCurrency = records?.findLast(service => service.price)?.price?.currency ?? PriceCurrencyEnum.Mkd;
  return <ProviderFrame locale={locale} path={path} current="services">
    <Surface className="space-y-6">
      <Heading>{t("providerServices.heading")}</Heading>
      <p>{t("providerServices.description")}</p>
      <p>{t("providerServices.privacy")}</p>
      {failed && <Notice role="alert">{t(`account.${failed}`)}</Notice>}
      {workspace.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={actionLinkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {workspace.state === "ready" && workspace.context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
      <RecordNoticeView locale={locale} notice={notice} />
      {profile?.state === "ready" && <PublicationStatus locale={locale} state={profile.profile.publicationState} />}
    </Surface>
    {records && <Surface>
      <section aria-labelledby="price-list" className="space-y-4">
        <h2 id="price-list" className="text-xl font-semibold text-ink">{t("providerServices.listHeading")}</h2>
        <PriceListEditor id="price-list" locale={locale} action={savePriceList.bind(null, locale)} messages={messages}
          recordMessages={recordMessages} currencies={currencies} defaultCurrency={defaultCurrency}
          suggestion={records.length === 0 ? t("providerServices.suggestedFirst") : undefined} loginHref={loginHref} reloadHref={path}
          initial={{ status: "idle", rows: records.map(service => rowOf(service, defaultCurrency)), blanks: blankRows.initial,
            paste: "", errors: {}, outcomes: {} }} />
      </section>
    </Surface>}
  </ProviderFrame>;
}
