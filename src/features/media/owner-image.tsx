// Loaded straight from the API's no-store owner route; never optimized, cached or turned into object URLs.
export function OwnerImage({ path, alt, className = "" }: { path: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- WEB-ADR-0006 forbids optimized derivatives of private or revocable images.
  return <img src={path} alt={alt} referrerPolicy="no-referrer" decoding="async" className={`h-auto max-w-full ${className}`} />;
}
