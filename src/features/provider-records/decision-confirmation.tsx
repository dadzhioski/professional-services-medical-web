import { TextAreaField, buttonClass } from "@/components/ui/presentation";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";

const cancelClass = buttonClass("secondary");

// Consequential decisions need this server-rendered second step, so they work without JavaScript. The form returns
// the revision or version that was on screen; a decision made against anything newer is refused by the API.
export function DecisionConfirmation({ id, heading, notes, field, value, reason, confirmLabel, pendingLabel, cancelLabel, cancelHref,
  action, destructive = false }: {
  id: string; heading: string; notes: string[]; field: "revision" | "version"; value: number;
  reason?: { label: string; hint: string; error?: string }; confirmLabel: string; pendingLabel: string; cancelLabel: string; cancelHref: string;
  action: (form: FormData) => Promise<void>; destructive?: boolean;
}) {
  const frame = destructive ? "border-danger bg-danger-tint text-ink" : "border-primary bg-tint text-ink";
  return <section aria-labelledby={id} className={`space-y-4 rounded-input border-2 p-4 ${frame}`}>
    <h2 id={id} className="text-xl font-semibold">{heading}</h2>
    {notes.map(note => <p key={note}>{note}</p>)}
    <form action={action} className="space-y-4">
      <input type="hidden" name={field} value={value} />
      {reason && <TextAreaField id={`${id}-reason`} name="reason" label={reason.label} hint={reason.hint} error={reason.error} required />}
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton label={confirmLabel} pendingLabel={pendingLabel} variant={destructive ? "danger" : "primary"} />
        <a className={cancelClass} href={cancelHref}>{cancelLabel}</a>
      </div>
    </form>
  </section>;
}
