import { notFound } from "next/navigation";

// Reserved feature routes have no synthetic production fallback.
export default function UnimplementedPage() {
  notFound();
}
