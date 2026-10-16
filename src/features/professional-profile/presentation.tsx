import type { ReactNode } from "react";
import { Heading, Section } from "@/components/ui/presentation";
import { translator, type Locale } from "@/lib/i18n";

// Display content only. The eventual API adapter owns all contract mapping.
export function ProfilePresentation({ locale, name, introduction, photo, specialties = [], credentials = [], services = [], locations = [] }: {
  locale: Locale; name: string; introduction?: string; photo?: ReactNode;
  specialties?: readonly string[]; credentials?: readonly string[]; services?: readonly string[]; locations?: readonly string[];
}) {
  const t = translator(locale);
  const groups = { specialties, credentials, services, locations };
  return <article className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {photo && <div className="w-32 shrink-0 overflow-hidden rounded-xl [&_img]:h-auto [&_img]:max-w-full">{photo}</div>}
      <Heading>{name}</Heading>
    </div>
    {introduction?.trim() && <Section id="profile-introduction" title={t("profile.introduction")}><p className="whitespace-pre-line leading-relaxed">{introduction}</p></Section>}
    <div className="grid min-w-0 gap-6 md:grid-cols-2">
      {(Object.keys(groups) as (keyof typeof groups)[]).map(key => {
        const items = groups[key].filter(item => item.trim());
        return items.length > 0 ? <Section key={key} id={`profile-${key}`} title={t(`profile.${key}`)}>
          <ul className="list-disc space-y-3 pl-5">{items.map((item, index) => <li key={index} className="whitespace-pre-line leading-relaxed">{item}</li>)}</ul>
        </Section> : null;
      })}
    </div>
  </article>;
}
