// Structured data is built only from supplied public fields: no image, rating, review, contact or identifier.
export type PhysicianData = {
  name: string; url: string; description: string;
  addresses: readonly { street: string; locality?: string; country?: string }[];
  credentials: readonly { name: string; category: string; issuer?: string }[];
};

export function physicianJsonLd({ name, url, description, addresses, credentials }: PhysicianData) {
  return {
    "@context": "https://schema.org", "@type": "Physician", name, url, description,
    ...(addresses.length ? { address: addresses.map(({ street, locality, country }) => ({ "@type": "PostalAddress",
      streetAddress: street, ...(locality ? { addressLocality: locality } : {}), ...(country ? { addressCountry: country } : {}) })) } : {}),
    ...(credentials.length ? { hasCredential: credentials.map(({ name: title, category, issuer }) => ({
      "@type": "EducationalOccupationalCredential", name: title, credentialCategory: category,
      ...(issuer ? { recognizedBy: { "@type": "Organization", name: issuer } } : {}) })) } : {}),
  };
}

// Inline script content: escaping these characters keeps supplied text from closing the script element or
// starting HTML comments, and keeps line separators valid in every JavaScript parser.
// Line and paragraph separators (U+2028, U+2029) are built from code points so the source stays plain ASCII.
const unsafe = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(unsafe, character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

// Collapses whitespace and shortens at a word boundary for search snippets.
export function metaDescription(text: string, limit = 160): string {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= limit) return plain;
  const cut = plain.slice(0, limit - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > limit / 2 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}
