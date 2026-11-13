import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import { buttonClass } from "@/components/ui/presentation";

const cancelClass = buttonClass("secondary");

// Removal always needs this explicit, server-rendered confirmation step, so it works without JavaScript.
export function RemoveConfirmation({ id, heading, item, note, confirmLabel, pendingLabel, cancelLabel, cancelHref, action }: {
  id: string; heading: string; item: string; note?: string; confirmLabel: string; pendingLabel: string;
  cancelLabel: string; cancelHref: string; action: () => Promise<void>;
}) {
  return <section aria-labelledby={id} className="space-y-4 rounded-input border-2 border-danger bg-danger-tint p-4 text-ink">
    <h2 id={id} className="text-xl font-semibold">{heading}</h2>
    <p className="font-semibold [overflow-wrap:anywhere]">{item}</p>
    {note && <p>{note}</p>}
    <form action={action} className="flex flex-wrap items-center gap-4">
      <SubmitButton label={confirmLabel} pendingLabel={pendingLabel} variant="danger" />
      <a className={cancelClass} href={cancelHref}>{cancelLabel}</a>
    </form>
  </section>;
}
