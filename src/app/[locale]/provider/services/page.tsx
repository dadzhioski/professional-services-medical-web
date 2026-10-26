import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceCurrencyEnum, type PracticeLocationResponse, type ServiceResponse } from "@dadzhioski/professional-services-api-client";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { recordMessageKeys, recordNotice, type RecordMessages } from "@/features/provider-records/form";
import { actionLinkClass, ProviderFrame, providerGate, PublicationStatus, RecordNoticeView, SignedOutView } from "@/features/provider-records/page-frame";
import { RemoveConfirmation } from "@/features/provider-records/remove-confirmation";
import { removeService, saveService } from "@/features/provider-services/actions";
import { emptyService, serviceMessageKeys, type ServiceMessages } from "@/features/provider-services/fields";
import { formatPrice } from "@/lib/price";
import { ServiceEditor } from "@/features/provider-services/service-editor";
import { listLocations } from "@/lib/api/locations";
import { readProfile } from "@/lib/api/profile";
import { listServices } from "@/lib/api/services";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; edit?: string; remove?: string }> };
const linkClass = "inline-block py-2 font-semibold text-blue-800 underline underline-offset-4";
const currencies = Object.values(PriceCurrencyEnum);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("providerServices.heading"), description: translator(locale)("providerServices.description"),
    robots: { index: false, follow: false } };
}

const locationName = (location: PracticeLocationResponse) =>
  location.label ? `${location.label}, ${location.displayAddress ?? ""}` : location.displayAddress ?? "";

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
  const [services, locations, profile] = ready ?
    await Promise.all([listServices(session), listLocations(session), readProfile(session)]) : [];
  // Services replace their linked locations on save, so editing needs both lists.
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    services && services.state !== "ready" ? services.state : locations && locations.state !== "ready" ? locations.state : undefined;
  const records = services?.state === "ready" && locations?.state === "ready" ? { services: services.records, locations: locations.records } : undefined;
  const query = await searchParams;
  const editing = records && query.edit ? records.services.find(service => service.serviceId === query.edit) : undefined;
  const removing = records && query.remove ? records.services.find(service => service.serviceId === query.remove) : undefined;
  const notice = records && ((query.edit && !editing) || (query.remove && !removing)) ? "notFound" : recordNotice(query.notice);
  const messages = Object.fromEntries(serviceMessageKeys.map(key => [key, t(key)])) as ServiceMessages;
  const recordMessages = Object.fromEntries(recordMessageKeys.map(key => [key, t(key)])) as RecordMessages;
  const options = records?.locations.map(location => ({ id: location.locationId!, label: locationName(location) })) ?? [];
  const locationLabel = (id: string) => options.find(option => option.id === id)?.label ?? t("providerServices.locationUnknown");
  const priceText = (service: ServiceResponse) => service.price ? formatPrice(locale, service.price.amount, service.price.currency) :
    t("providerServices.priceNotPublished");
  const editor = (service?: ServiceResponse) => <ServiceEditor id={service ? "service-edit" : "service-new"} locale={locale}
    action={saveService.bind(null, locale, service?.serviceId)} messages={messages} recordMessages={recordMessages}
    currencies={currencies} locations={options} locationsHref={`/${locale}/provider/locations`} loginHref={loginHref}
    reloadHref={service ? `${path}?edit=${encodeURIComponent(service.serviceId!)}` : path}
    initial={{ status: "idle", errors: {}, version: service?.version, values: service ? {
      name: service.name ?? "", description: service.description ?? "", priceMode: service.price ? "price" : "none",
      amount: service.price?.amount ?? "", currency: service.price?.currency ?? "", locationIds: service.locationIds ?? [],
    } : emptyService }} />;
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
    {records && removing && <RemoveConfirmation id="service-remove" heading={t("providerServices.removeHeading")}
      item={removing.name ?? ""} confirmLabel={t("records.removeConfirm")} pendingLabel={t("records.removing")}
      cancelLabel={t("records.cancel")} cancelHref={path} action={removeService.bind(null, locale, removing.serviceId!)} />}
    {records && editing && <Surface>
      <section aria-labelledby="service-edit-heading" className="space-y-4">
        <h2 id="service-edit-heading" className="text-xl font-semibold text-teal-950">{t("providerServices.editHeading")}</h2>
        {editor(editing)}
        <a className={linkClass} href={path}>{t("records.cancel")}</a>
      </section>
    </Surface>}
    {records && <Surface>
      <section aria-labelledby="service-list" className="space-y-4">
        <h2 id="service-list" className="text-xl font-semibold text-teal-950">{t("providerServices.listHeading")}</h2>
        {records.services.length === 0 ? <p>{t("providerServices.empty")}</p> : <ul className="space-y-4">
          {records.services.map(service => <li key={service.serviceId} className="space-y-2 rounded-lg border border-slate-300 p-4 [overflow-wrap:anywhere]">
            <h3 className="text-lg font-semibold text-teal-950">{service.name}</h3>
            {service.description && <p className="whitespace-pre-line">{service.description}</p>}
            <dl className="grid gap-1">
              <dt className="font-semibold">{t("providerServices.price")}</dt><dd>{priceText(service)}</dd>
              <dt className="font-semibold">{t("providerServices.locations")}</dt>
              <dd>{service.locationIds?.length ? service.locationIds.map(locationLabel).join("; ") : t("records.empty")}</dd>
            </dl>
            <p className="flex flex-wrap gap-4">
              <a className={linkClass} href={`${path}?edit=${encodeURIComponent(service.serviceId!)}#service-edit-heading`}>
                {t("records.edit")}<span className="sr-only">: {service.name}</span></a>
              <a className={linkClass} href={`${path}?remove=${encodeURIComponent(service.serviceId!)}#service-remove`}>
                {t("records.remove")}<span className="sr-only">: {service.name}</span></a>
            </p>
          </li>)}
        </ul>}
      </section>
    </Surface>}
    {records && !editing && <Surface>
      <section aria-labelledby="service-add" className="space-y-4">
        <h2 id="service-add" className="text-xl font-semibold text-teal-950">{t("providerServices.add")}</h2>
        {editor()}
      </section>
    </Surface>}
  </ProviderFrame>;
}
