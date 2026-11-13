import { Notice, buttonClass } from "@/components/ui/presentation";
import { outcomeMessage } from "@/features/media/form";
import { translator, type Locale } from "@/lib/i18n";
import { reviewOutcomes } from "./outcomes";

export const linkClass = "inline-block py-2 font-semibold text-primary underline underline-offset-4";
export const decisionLinkClass = buttonClass("secondary");

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
