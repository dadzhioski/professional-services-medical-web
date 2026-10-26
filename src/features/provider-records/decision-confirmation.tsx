import { TextAreaField } from "@/components/ui/presentation";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";

const cancelClass = "inline-block min-h-11 rounded-lg border-2 border-teal-800 px-5 py-3 font-semibold text-teal-950 underline hover:bg-teal-50";

// Consequential decisions need this server-rendered second step, so they work without JavaScript. The form returns
// the revision or version that was on screen; a decision made against anything newer is refused by the API.
export function DecisionConfirmation({ id, heading, notes, field, value, reason, confirmLabel, pendingLabel, cancelLabel, cancelHref,
  action, destructive = false }: {
  id: string; heading: string; notes: string[]; field: "revision" | "version"; value: number;
  reason?: { label: string; hint: string }; confirmLabel: string; pendingLabel: string; cancelLabel: string; cancelHref: string;
  action: (form: FormData) => Promise<void>; destructive?: boolean;
}) {
  const frame = destructive ? "border-red-800 bg-red-50 text-red-950" : "border-teal-800 bg-teal-50 text-teal-950";
  return <section aria-labelledby={id} className={`space-y-4 rounded-lg border-2 p-4 ${frame}`}>
    <h2 id={id} className="text-xl font-semibold">{heading}</h2>
    {notes.map(note => <p key={note}>{note}</p>)}
    <form action={action} className="space-y-4">
      <input type="hidden" name={field} value={value} />
      {reason && <TextAreaField id={`${id}-reason`} name="reason" label={reason.label} hint={reason.hint} required />}
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton label={confirmLabel} pendingLabel={pendingLabel} className={destructive ? "!bg-red-800 hover:!bg-red-900" : ""} />
        <a className={cancelClass} href={cancelHref}>{cancelLabel}</a>
      </div>
    </form>
  </section>;
}
