"use client";

import { Fragment, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/presentation";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import type { RecordMessages, RecordState } from "./form";

type Values = Record<string, unknown>;
export type RecordAction<V extends Values, L> = (previous: RecordState<V, L>, form: FormData) => Promise<RecordState<V, L>>;
export type SavedLink = { href: string; label: string };
export const linkClass = "font-semibold text-blue-800 underline underline-offset-4";

// Shared failure summary, conflict review and submission for record editors; callers render the fields.
export function RecordEditor<V extends Values, L = V>({ id, action, initial, messages: m, labels, loginHref, reloadHref,
  saveLabel, savedLabel, savedLink, latest, children }: {
  id: string; action: RecordAction<V, L>; initial: RecordState<V, L>; messages: RecordMessages;
  labels: Partial<Record<keyof V & string, string>>; loginHref: string; reloadHref: string; saveLabel: string; savedLabel?: string; savedLink?: SavedLink;
  latest: (latest: L) => ReactNode; children: (state: RecordState<V, L>, error: (field: keyof V & string) => string | undefined) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, initial);
  // React resets forms after an action; selects would fall back to their first-render default, so each
  // result remounts the fields with the echoed values as their defaults.
  const [result, setResult] = useState({ state, key: 0 });
  if (result.state !== state) setResult({ state, key: result.key + 1 });
  const summary = useRef<HTMLElement>(null);
  // Move keyboard focus to the error summary once per failed submission. Page refreshes from other
  // editors create a new `initial`, so only a new action result may move focus.
  const focused = useRef(state);
  useEffect(() => {
    if (focused.current === state) return;
    focused.current = state;
    if (state.status !== "saved") summary.current?.focus();
  }, [state]);
  const status = state.status;
  const failed = status !== "idle" && status !== "saved";
  const invalidFields = (Object.keys(labels) as (keyof V & string)[]).filter(field => state.errors[field]);
  const error = (field: keyof V & string) => {
    const kind = state.errors[field];
    return kind && m[`records.error.${kind}`];
  };
  const message = status === "idle" || status === "saved" ? undefined :
    status === "invalid" || status === "rejected" || status === "conflict" || status === "notFound" ? m[`records.${status}`] :
      `${m[`account.${status}`]} ${m["records.keptInput"]}`;
  return <div className="space-y-6">
    {/* The live region stays mounted so screen readers announce text added to it. */}
    <div role="status">{status === "saved" && savedLabel && <Notice>{savedLabel}
      {savedLink && <> <a className={linkClass} href={savedLink.href}>{savedLink.label}</a></>}</Notice>}</div>
    {/* Focus moves here on failure, so no alert role is added to avoid a second announcement. */}
    {failed && <section ref={summary} tabIndex={-1} aria-labelledby={`${id}-problem`}
      className="space-y-3 rounded-lg border-2 border-red-800 bg-red-50 p-4 text-red-950">
      <h3 id={`${id}-problem`} className="text-lg font-semibold">{m["records.problem"]}</h3>
      <p>{message}</p>
      {invalidFields.length > 0 && <ul className="list-disc space-y-1 pl-5">
        {invalidFields.map(field => <li key={field}><a className={linkClass} href={`#${id}-${field}`}
          // Fragment navigation alone does not move focus into the field.
          onClick={event => { event.preventDefault(); document.getElementById(`${id}-${field}`)?.focus(); }}>
          {labels[field]}: {error(field)}</a></li>)}
      </ul>}
      {(status === "expired" || status === "signedOut") && <a className={linkClass} href={loginHref}>{m["account.login"]}</a>}
      {status === "notFound" && <a className={linkClass} href={reloadHref}>{m["records.discard"]}</a>}
    </section>}
    {status === "conflict" && <section aria-labelledby={`${id}-latest`} className="space-y-3 rounded-lg border border-slate-400 p-4">
      <h3 id={`${id}-latest`} className="text-lg font-semibold text-teal-950">{m["records.latestHeading"]}</h3>
      {state.latest && latest(state.latest)}
      <a className={linkClass} href={reloadHref}>{m["records.discard"]}</a>
    </section>}
    <form action={formAction} className="space-y-6">
      {state.version !== undefined && <input type="hidden" name="version" value={state.version} />}
      <Fragment key={result.key}>{children(state, error)}</Fragment>
      <div className="flex flex-wrap gap-4">
        <SubmitButton label={saveLabel} pendingLabel={m["records.saving"]} />
        {status === "conflict" && state.latest &&
          <SubmitButton name="overwriteVersion" value={String(state.latest.version)} className="border-2 border-teal-800 !bg-white !text-teal-950 hover:!bg-teal-50"
            label={m["records.overwrite"]} pendingLabel={m["records.saving"]} />}
      </div>
    </form>
  </div>;
}
