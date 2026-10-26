import { Notice } from "@/components/ui/presentation";
import { outcomeMessage } from "@/features/media/form";
import { translator, type Locale } from "@/lib/i18n";
import { reviewOutcomes } from "./outcomes";

export const linkClass = "inline-block py-2 font-semibold text-blue-800 underline underline-offset-4";
export const decisionLinkClass = "inline-block min-h-11 rounded-lg border-2 border-teal-800 px-5 py-3 font-semibold text-teal-950 underline hover:bg-teal-50";

export const formatDate = (locale: Locale, date: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
// Registration and submission times are instants, shown in UTC so every reviewer reads the same value.
export const formatInstant = (locale: Locale, date: Date) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "long", timeZone: "UTC" }).format(date);

export function ReviewOutcome({ locale, value }: { locale: Locale; value: unknown }) {
  const message = outcomeMessage(reviewOutcomes, value);
  if (!message) return null;
  return <div id="review-outcome">
    <Notice role={message.success ? "status" : "alert"}>{translator(locale)(message.key)}</Notice>
  </div>;
}
