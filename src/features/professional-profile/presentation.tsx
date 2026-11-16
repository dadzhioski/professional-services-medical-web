import type { ReactNode } from "react";
import { cardClass, Heading, Section } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";

export type PriceEntry = { name: string; price?: string; description?: string };
// Display content only: already-translated, already-formatted text. The API adapter owns all contract mapping.
export type CredentialEntry = { heading: string; issuer?: string; issued?: string; expiry?: string };
export type LocationEntry = { label?: string; address: string; city?: string };

const listItemClass = "space-y-1 rounded-input border border-border bg-canvas p-4 leading-relaxed";

// Display content only. The eventual API adapter owns all contract mapping.
export function ProfilePresentation({ locale, name, introduction, photo, nested = false, specialties = [], cities = [],
  credentials = [], services = [], locations = [], aside }: {
  locale: Locale; name: string; introduction?: string; photo?: ReactNode; nested?: boolean; specialties?: readonly string[];
  cities?: readonly string[]; credentials?: readonly CredentialEntry[]; services?: readonly PriceEntry[];
  locations?: readonly LocationEntry[]; aside?: ReactNode;
}) {
  const t = translator(locale);
  // Nested previews sit under a page section heading, so every level moves down.
  const level = nested ? 4 : 2;
  const summary = specialties.filter(item => item.trim()).join(", ");
  const place = cities.filter(item => item.trim()).join(", ");
  const specialtyItems = specialties.filter(item => item.trim());
  const credentialItems = credentials.filter(item => item.heading.trim());
  const locationItems = locations.filter(item => item.address.trim());
  const sections = <div className="min-w-0 space-y-6">
    {introduction?.trim() && <Section id="profile-introduction" level={level} title={t("profile.introduction")}><p className="whitespace-pre-line leading-relaxed">{introduction}</p></Section>}
    {/* Informational only: patients cannot choose services; the doctor decides at the examination. */}
    {services.length > 0 && <Section id="profile-services" level={level} title={t("profile.services")}>
      <table aria-labelledby="profile-services" className="w-full border-collapse text-left">
        <thead><tr className="border-b border-control">
          <th scope="col" className="py-2 pr-4 font-semibold">{t("profile.priceService")}</th>
          <th scope="col" className="py-2 text-right font-semibold">{t("profile.pricePrice")}</th>
        </tr></thead>
        <tbody>{services.map((service, index) => <tr key={index} className="border-b border-border align-top">
          <th scope="row" className="py-3 pr-4 font-normal">
            <span className="font-semibold">{service.name}</span>
            {service.description && <span className="block whitespace-pre-line text-sm text-muted">{service.description}</span>}
          </th>
          <td className="py-3 text-right">{service.price ?? t("profile.priceOnRequest")}</td>
        </tr>)}</tbody>
      </table>
      <p className="text-sm text-muted">{t("profile.priceNote")}</p>
    </Section>}
    {specialtyItems.length > 0 && <Section id="profile-specialties" level={level} title={t("profile.specialties")}>
      <ul className="list-disc space-y-1 pl-5">{specialtyItems.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </Section>}
    {credentialItems.length > 0 && <Section id="profile-credentials" level={level} title={t("profile.credentials")}>
      <ul className="space-y-3">{credentialItems.map((item, index) => <li key={index} className={listItemClass}>
        <p className="font-semibold text-ink">{item.heading}</p>
        {item.issuer && <p>{item.issuer}</p>}
        {(item.issued || item.expiry) && <p className="text-sm text-muted">{[item.issued, item.expiry].filter(Boolean).join(" · ")}</p>}
      </li>)}</ul>
    </Section>}
    {/* Label and address only: no map (no third-party scripts) and no hours (not in the public response). */}
    {locationItems.length > 0 && <Section id="profile-locations" level={level} title={t("profile.locations")}>
      <ul className="grid gap-3 sm:grid-cols-2">{locationItems.map((item, index) => <li key={index} className={listItemClass}>
        {item.label && <p className="font-semibold text-ink">{item.label}</p>}
        <p className="whitespace-pre-line">{item.address}</p>
        {item.city && <p className="text-muted">{item.city}</p>}
      </li>)}</ul>
    </Section>}
  </div>;
  return <article className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    {/* Header card: photo, name, a one-line specialty summary and the cities; the full content follows as section cards. */}
    <div className={`flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8 ${cardClass}`}>
      {photo && <div className="w-32 shrink-0 overflow-hidden rounded-card sm:w-40 [&_img]:h-auto [&_img]:max-w-full">{photo}</div>}
      <div className="min-w-0 space-y-2">
        {nested ? <h3 className="text-2xl font-semibold leading-tight tracking-tight text-ink">{name}</h3> : <Heading>{name}</Heading>}
        {summary && <p className="text-lg text-muted">{summary}</p>}
        {place && <p className="text-muted">{place}</p>}
      </div>
    </div>
    {aside ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {sections}<div className="min-w-0 space-y-6">{aside}</div></div> : sections}
  </article>;
}
