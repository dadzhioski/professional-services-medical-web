import type { ReactNode } from "react";
import { Heading, Section } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";

export type PriceEntry = { name: string; price?: string; description?: string };
// Provider-authored plain text pasted from a CV; shown with its line breaks, never as markup.
export type Qualifications = { education?: string | null; specialties?: string | null; certificates?: string | null };

// Display content only. The eventual API adapter owns all contract mapping.
export function ProfilePresentation({ locale, name, introduction, photo, nested = false, specialties = [], qualifications = {}, services = [], locations = [] }: {
  locale: Locale; name: string; introduction?: string; photo?: ReactNode; nested?: boolean;
  specialties?: readonly string[]; qualifications?: Qualifications; services?: readonly PriceEntry[]; locations?: readonly string[];
}) {
  const t = translator(locale);
  const listed = specialties.filter(item => item.trim());
  const text = (value?: string | null) => value?.trim() ? <p className="whitespace-pre-line leading-relaxed">{value.trim()}</p> : null;
  const sections = {
    specialties: (listed.length > 0 || qualifications.specialties?.trim()) && <>
      {listed.length > 0 && <ul className="list-disc space-y-3 pl-5">{listed.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      {text(qualifications.specialties)}
    </>,
    education: text(qualifications.education),
    certificates: text(qualifications.certificates),
    locations: locations.some(item => item.trim()) && <ul className="list-disc space-y-3 pl-5">
      {locations.filter(item => item.trim()).map((item, index) => <li key={index} className="whitespace-pre-line leading-relaxed">{item}</li>)}</ul>,
  };
  // Nested previews sit under a page section heading, so every level moves down.
  const level = nested ? 4 : 2;
  return <article className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {photo && <div className="w-32 shrink-0 overflow-hidden rounded-xl [&_img]:h-auto [&_img]:max-w-full">{photo}</div>}
      {nested ? <h3 className="text-2xl font-bold tracking-tight text-teal-950">{name}</h3> : <Heading>{name}</Heading>}
    </div>
    {introduction?.trim() && <Section id="profile-introduction" level={level} title={t("profile.introduction")}><p className="whitespace-pre-line leading-relaxed">{introduction}</p></Section>}
    <div className="grid min-w-0 gap-6 md:grid-cols-2">
      {(Object.keys(sections) as (keyof typeof sections)[]).map(key => sections[key] ?
        <Section key={key} id={`profile-${key}`} level={level} title={t(`profile.${key}`)}>{sections[key]}</Section> : null)}
    </div>
    {/* Informational only: patients cannot choose services; the doctor decides at the examination. */}
    {services.length > 0 && <Section id="profile-services" level={level} title={t("profile.services")}>
      <table aria-labelledby="profile-services" className="w-full border-collapse text-left">
        <thead><tr className="border-b border-slate-400">
          <th scope="col" className="py-2 pr-4 font-semibold">{t("profile.priceService")}</th>
          <th scope="col" className="py-2 text-right font-semibold">{t("profile.pricePrice")}</th>
        </tr></thead>
        <tbody>{services.map((service, index) => <tr key={index} className="border-b border-slate-200 align-top">
          <th scope="row" className="py-3 pr-4 font-normal">
            <span className="font-semibold">{service.name}</span>
            {service.description && <span className="block whitespace-pre-line text-sm text-slate-700">{service.description}</span>}
          </th>
          <td className="py-3 text-right">{service.price ?? t("profile.priceOnRequest")}</td>
        </tr>)}</tbody>
      </table>
      <p className="text-sm text-slate-700">{t("profile.priceNote")}</p>
    </Section>}
  </article>;
}
