// Loaded straight from the API's no-store owner route; never optimized, cached or turned into object URLs.
// Thumbnails load lazily at a fixed display size; the original image is still served (no derivatives).
export function OwnerImage({ path, alt, className = "", thumbnail = false }: { path: string; alt: string; className?: string;
  thumbnail?: boolean }) {
  const size = thumbnail ? { width: 64, height: 64, loading: "lazy" as const } : {};
  // eslint-disable-next-line @next/next/no-img-element -- WEB-ADR-0006 forbids optimized derivatives of private or revocable images.
  return <img src={path} alt={alt} referrerPolicy="no-referrer" decoding="async" {...size}
    className={`${thumbnail ? "h-16 w-16 shrink-0 rounded-lg object-cover" : "h-auto max-w-full"} ${className}`} />;
}
