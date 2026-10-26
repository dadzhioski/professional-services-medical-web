import type { PublicProfileResponse } from "@dadzhioski/professional-services-api-client";
import { formatDate } from "@/features/admin-review/review-parts";
import { credentialTypeKey } from "@/features/provider-credentials/labels";
import { translator, type Locale } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";
import { formatPrice } from "@/lib/price";
import { metaDescription, type PhysicianData } from "@/lib/seo/structured-data";

const lines = (...parts: (string | null | undefined | false)[]) => parts.filter(part => part && part.trim()).join("\n");

// Maps only the named public fields; provider-supplied text is passed on as text, never as markup.
export function publicContent(profile: PublicProfileResponse, locale: Locale) {
  const t = translator(locale);
  const specialty = profile.specialty ? referenceLabel(profile.specialty.labels, profile.specialty.code!, locale) : undefined;
  const credentials = (profile.credentials ?? []).map(credential => ({ name: credential.title!,
    category: t(credentialTypeKey(credential.type!)), issuer: credential.issuer?.trim() || undefined, credential }));
  const locations = (profile.locations ?? []).map(location => ({ label: location.label?.trim() || undefined,
    street: location.displayAddress!, country: location.countryCode,
    locality: location.city ? referenceLabel(location.city.labels, location.city.code!, locale) : undefined }));
  const title = specialty ? `${profile.displayName} – ${specialty}` : profile.displayName!;
  return {
    title,
    description: metaDescription(profile.biography?.trim() || `${title}. ${t("publicProfile.descriptionFallback")}`),
    specialties: specialty ? [specialty] : [],
    credentials: credentials.map(({ name, category, issuer, credential }) => lines(`${category}: ${name}`, issuer,
      credential.issuedOn && `${t("credentials.issued")}: ${formatDate(locale, credential.issuedOn)}`,
      credential.expiresOn ? `${t("credentials.expires")}: ${formatDate(locale, credential.expiresOn)}` : t("credentials.noExpiry"))),
    services: (profile.services ?? []).map(service => lines(
      service.price ? `${service.name} — ${formatPrice(locale, service.price.amount!, service.price.currency!)}` : service.name,
      service.description)),
    locations: locations.map(location => lines(location.label, location.street, location.locality)),
    structured: { addresses: locations.map(({ street, locality, country }) => ({ street, locality, country })),
      credentials: credentials.map(({ name, category, issuer }) => ({ name, category, issuer })) } satisfies
      Pick<PhysicianData, "addresses" | "credentials">,
  };
}
