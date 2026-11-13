import type { ReactNode } from "react";
import { cardClass, Heading, Section } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";

export type PriceEntry = { name: string; price?: string; description?: string };

// Display content only. The eventual API adapter owns all contract mapping.
export function ProfilePresentation({ locale, name, introduction, photo, nested = false, specialties = [], credentials = [], services = [], locations = [] }: {
  locale: Locale; name: string; introduction?: string; photo?: ReactNode; nested?: boolean;
  specialties?: readonly string[]; credentials?: readonly string[]; services?: readonly PriceEntry[]; locations?: readonly string[];
}) {
  const t = translator(locale);
  const groups = { specialties, credentials, locations };
  // Nested previews sit under a page section heading, so every level moves down.
  const level = nested ? 4 : 2;
  const summary = specialties.filter(item => item.trim()).join(", ");
  return <article className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    {/* Header card: photo, name and a one-line specialty summary; the full lists follow as section cards. */}
    <div className={`flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8 ${cardClass}`}>
      {photo && <div className="w-32 shrink-0 overflow-hidden rounded-card [&_img]:h-auto [&_img]:max-w-full">{photo}</div>}
      <div className="min-w-0 space-y-2">
        {nested ? <h3 className="text-2xl font-semibold leading-tight tracking-tight text-ink">{name}</h3> : <Heading>{name}</Heading>}
        {summary && <p className="text-lg text-muted">{summary}</p>}
      </div>
    </div>
    {introduction?.trim() && <Section id="profile-introduction" level={level} title={t("profile.introduction")}><p className="whitespace-pre-line leading-relaxed">{introduction}</p></Section>}
    <div className="grid min-w-0 gap-6 md:grid-cols-2">
      {(Object.keys(groups) as (keyof typeof groups)[]).map(key => {
        const items = groups[key].filter(item => item.trim());
        return items.length > 0 ? <Section key={key} id={`profile-${key}`} level={level} title={t(`profile.${key}`)}>
          <ul className="list-disc space-y-3 pl-5">{items.map((item, index) => <li key={index} className="whitespace-pre-line leading-relaxed">{item}</li>)}</ul>
        </Section> : null;
      })}
    </div>
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
  </article>;
}
