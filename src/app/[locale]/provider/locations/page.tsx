import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PracticeLocationResponse } from "@dadzhioski/professional-services-api-client";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { removeLocation, saveLocation } from "@/features/provider-locations/actions";
import { emptyLocation, locationMessageKeys, type LocationMessages } from "@/features/provider-locations/fields";
import { LocationEditor, type CountryOption } from "@/features/provider-locations/location-editor";
import { recordMessageKeys, recordNotice, type RecordMessages } from "@/features/provider-records/form";
import { actionLinkClass, ProviderFrame, providerGate, PublicationStatus, RecordNoticeView, SignedOutView } from "@/features/provider-records/page-frame";
import { RemoveConfirmation } from "@/features/provider-records/remove-confirmation";
import { listLocations } from "@/lib/api/locations";
import { readProfile } from "@/lib/api/profile";
import { listCities, listCountries } from "@/lib/api/reference";
import { isLocale, translator } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; edit?: string; remove?: string }> };
const linkClass = "inline-block py-2 font-semibold text-blue-800 underline underline-offset-4";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("providerLocations.heading"), description: translator(locale)("providerLocations.description"),
    robots: { index: false, follow: false } };
}

export default async function LocationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/provider/locations`;
  const gate = await providerGate(locale);
  if (gate.state !== "authenticated") {
    return <SignedOutView locale={locale} path={path} heading="providerLocations.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const { session, workspace, loginHref } = gate;
  const ready = workspace.state === "ready";
  const [locations, countries, cities, profile] = ready ?
    await Promise.all([listLocations(session), listCountries(), listCities(), readProfile(session)]) : [];
  // Editing needs the reference lists as well, so a missing list hides the editors rather than guessing.
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    locations && locations.state !== "ready" ? locations.state :
      (countries && countries.state !== "ready") || (cities && cities.state !== "ready") ? "unavailable" : undefined;
  const records = locations?.state === "ready" && countries?.state === "ready" && cities?.state === "ready" ? locations.records : undefined;
  const options: CountryOption[] = countries?.state === "ready" && cities?.state === "ready" ? countries.records.map(country => ({
    code: country.code!, label: referenceLabel(country.labels, country.code!, locale),
    cities: cities.records.filter(city => city.countryCode === country.code)
      .map(city => ({ id: city.id!, label: referenceLabel(city.labels, city.code!, locale) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
  })).sort((a, b) => a.label.localeCompare(b.label, locale)) : [];
  const query = await searchParams;
  const editing = records && query.edit ? records.find(location => location.locationId === query.edit) : undefined;
  const removing = records && query.remove ? records.find(location => location.locationId === query.remove) : undefined;
  const notice = records && ((query.edit && !editing) || (query.remove && !removing)) ? "notFound" : recordNotice(query.notice);
  const messages = Object.fromEntries(locationMessageKeys.map(key => [key, t(key)])) as LocationMessages;
  const recordMessages = Object.fromEntries(recordMessageKeys.map(key => [key, t(key)])) as RecordMessages;
  const place = (location: PracticeLocationResponse) => {
    const country = options.find(option => option.code === location.countryCode);
    const city = country?.cities.find(option => option.id === location.cityId)?.label ?? t("providerLocations.retired");
    return `${city}, ${country?.label ?? location.countryCode}`;
  };
  const title = (location: PracticeLocationResponse) => location.label || location.displayAddress || "";
  const editor = (location?: PracticeLocationResponse) => <LocationEditor id={location ? "location-edit" : "location-new"}
    action={saveLocation.bind(null, locale, location?.locationId)} messages={messages} recordMessages={recordMessages}
    countries={options} loginHref={loginHref} reloadHref={location ? `${path}?edit=${encodeURIComponent(location.locationId!)}` : path}
    initial={{ status: "idle", errors: {}, version: location?.version, values: location ? {
      label: location.label ?? "", countryCode: location.countryCode ?? "", cityId: location.cityId ?? "",
      displayAddress: location.displayAddress ?? "",
    } : emptyLocation }} />;
  return <ProviderFrame locale={locale} path={path} current="locations">
    <Surface className="space-y-6">
      <Heading>{t("providerLocations.heading")}</Heading>
      <p>{t("providerLocations.description")}</p>
      <p>{t("providerLocations.privacy")}</p>
      {failed && <Notice role="alert">{t(`account.${failed}`)}</Notice>}
      {workspace.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={actionLinkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {workspace.state === "ready" && workspace.context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
      <RecordNoticeView locale={locale} notice={notice} />
      {profile?.state === "ready" && <PublicationStatus locale={locale} state={profile.profile.publicationState} />}
    </Surface>
    {records && removing && <RemoveConfirmation id="location-remove" heading={t("providerLocations.removeHeading")}
      item={title(removing)} note={t("providerLocations.removeNote")} confirmLabel={t("records.removeConfirm")}
      pendingLabel={t("records.removing")} cancelLabel={t("records.cancel")} cancelHref={path}
      action={removeLocation.bind(null, locale, removing.locationId!)} />}
    {records && editing && <Surface>
      <section aria-labelledby="location-edit-heading" className="space-y-4">
        <h2 id="location-edit-heading" className="text-xl font-semibold text-teal-950">{t("providerLocations.editHeading")}</h2>
        {editor(editing)}
        <a className={linkClass} href={path}>{t("records.cancel")}</a>
      </section>
    </Surface>}
    {records && <Surface>
      <section aria-labelledby="location-list" className="space-y-4">
        <h2 id="location-list" className="text-xl font-semibold text-teal-950">{t("providerLocations.listHeading")}</h2>
        {records.length === 0 ? <p>{t("providerLocations.empty")}</p> : <ul className="space-y-4">
          {records.map(location => <li key={location.locationId} className="space-y-2 rounded-lg border border-slate-300 p-4 [overflow-wrap:anywhere]">
            <h3 className="text-lg font-semibold text-teal-950">{title(location)}</h3>
            <dl className="grid gap-1">
              <dt className="font-semibold">{t("providerLocations.address")}</dt><dd>{location.displayAddress}</dd>
              <dt className="font-semibold">{t("providerLocations.city")}</dt><dd>{place(location)}</dd>
            </dl>
            <p className="flex flex-wrap gap-4">
              <a className={linkClass} href={`${path}?edit=${encodeURIComponent(location.locationId!)}#location-edit-heading`}>
                {t("records.edit")}<span className="sr-only">: {title(location)}</span></a>
              <a className={linkClass} href={`${path}?remove=${encodeURIComponent(location.locationId!)}#location-remove`}>
                {t("records.remove")}<span className="sr-only">: {title(location)}</span></a>
            </p>
          </li>)}
        </ul>}
      </section>
    </Surface>}
    {records && !editing && <Surface>
      <section aria-labelledby="location-add" className="space-y-4">
        <h2 id="location-add" className="text-xl font-semibold text-teal-950">{t("providerLocations.add")}</h2>
        {editor()}
      </section>
    </Surface>}
  </ProviderFrame>;
}
