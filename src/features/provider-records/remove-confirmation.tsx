import { SubmitButton } from "@/features/provider-onboarding/submit-button";

const cancelClass = "inline-block min-h-11 rounded-lg border-2 border-teal-800 px-5 py-3 font-semibold text-teal-950 underline hover:bg-teal-50";

// Removal always needs this explicit, server-rendered confirmation step, so it works without JavaScript.
export function RemoveConfirmation({ id, heading, item, note, confirmLabel, pendingLabel, cancelLabel, cancelHref, action }: {
  id: string; heading: string; item: string; note?: string; confirmLabel: string; pendingLabel: string;
  cancelLabel: string; cancelHref: string; action: () => Promise<void>;
}) {
  return <section aria-labelledby={id} className="space-y-4 rounded-lg border-2 border-red-800 bg-red-50 p-4 text-red-950">
    <h2 id={id} className="text-xl font-semibold">{heading}</h2>
    <p className="font-semibold [overflow-wrap:anywhere]">{item}</p>
    {note && <p>{note}</p>}
    <form action={action} className="flex flex-wrap items-center gap-4">
      <SubmitButton label={confirmLabel} pendingLabel={pendingLabel} className="!bg-red-800 hover:!bg-red-900" />
      <a className={cancelClass} href={cancelHref}>{cancelLabel}</a>
    </form>
  </section>;
}
