import type { PublicProfileResponse } from "@dadzhioski/professional-services-api-client";
import { translator, type Locale } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";
import { formatPrice } from "@/lib/price";
import { metaDescription, type PhysicianData } from "@/lib/seo/structured-data";

const lines = (...parts: (string | null | undefined | false)[]) => parts.filter(part => part && part.trim()).join("\n");

// Maps only the named public fields; provider-supplied text is passed on as text, never as markup.
export function publicContent(profile: PublicProfileResponse, locale: Locale) {
  const t = translator(locale);
  const specialty = profile.specialty ? referenceLabel(profile.specialty.labels, profile.specialty.code!, locale) : undefined;
  const locations = (profile.locations ?? []).map(location => ({ label: location.label?.trim() || undefined,
    street: location.displayAddress!, country: location.countryCode,
    locality: location.city ? referenceLabel(location.city.labels, location.city.code!, locale) : undefined }));
  const title = specialty ? `${profile.displayName} – ${specialty}` : profile.displayName!;
  return {
    title,
    description: metaDescription(profile.biography?.trim() || `${title}. ${t("publicProfile.descriptionFallback")}`),
    specialties: specialty ? [specialty] : [],
    // The deprecated credential list is always empty from 0.9.0 on and is not read.
    qualifications: { education: profile.education, specialties: profile.specialties, certificates: profile.certificates },
    services: (profile.services ?? []).map(service => ({ name: service.name!, description: service.description?.trim() || undefined,
      price: service.price ? formatPrice(locale, service.price.amount!, service.price.currency!) : undefined })),
    locations: locations.map(location => lines(location.label, location.street, location.locality)),
    structured: { addresses: locations.map(({ street, locality, country }) => ({ street, locality, country })) } satisfies
      Pick<PhysicianData, "addresses">,
  };
}
