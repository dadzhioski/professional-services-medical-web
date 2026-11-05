"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Notice, TextAreaField } from "@/components/ui/presentation";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import type { SavedLink } from "@/features/provider-records/record-editor";
import type { EditorMessages, EditorState, TextValues } from "./fields";

// Labels arrive translated; `rows` makes the field a multi-line textarea.
export type TextFieldSpec<Field extends string> = { name: Field; label: string; hint: string; maxLength: number; rows?: number };
type SaveAction<Values extends TextValues> = (previous: EditorState<Values>, form: FormData) => Promise<EditorState<Values>>;
const linkClass = "font-semibold text-blue-800 underline underline-offset-4";

// One form of profile text fields saved together; `idPrefix` keeps ids unique when several forms share a page.
export function ProfileEditor<Values extends TextValues>({ action, initial, fields, idPrefix = "profile", saveLabel, messages: m,
  loginHref, reloadHref, savedLink }: {
  action: SaveAction<Values>; initial: EditorState<Values>; fields: readonly TextFieldSpec<Extract<keyof Values, string>>[];
  idPrefix?: string; saveLabel: string; messages: EditorMessages; loginHref: string; reloadHref: string; savedLink?: SavedLink;
}) {
  const [state, formAction] = useActionState(action, initial);
  // Server re-renders hand in a new `initial`; only the first one is the action's starting state.
  const [first] = useState(initial);
  const summary = useRef<HTMLElement>(null);
  // Move keyboard focus to the error summary whenever a submission fails.
  useEffect(() => {
    if (state !== first && state.status !== "saved") summary.current?.focus();
  }, [state, first]);
  // Other forms on the page save disjoint fields of the same profile and bump its version; the re-rendered
  // `initial` carries that version, so typed input is never discarded by a remount. After a conflict only the
  // explicit overwrite choice may send a newer version.
  const version = state.status === "conflict" ? state.version : Math.max(state.version, initial.version);
  const failed = state.status !== "idle" && state.status !== "saved";
  const invalidFields = fields.filter(field => state.errors[field.name]);
  const status = state.status;
  const message = status === "invalid" ? m["profileEditor.invalid"] : status === "conflict" ? m["profileEditor.conflict"] :
    status === "idle" || status === "saved" ? undefined : `${m[`account.${status}`]} ${m["profileEditor.keptInput"]}`;
  const fieldError = (field: keyof Values) => state.errors[field] ? m["profileEditor.tooLong"] : undefined;
  const fieldId = (field: string) => `${idPrefix}-${field}`;
  return <div className="space-y-6">
    {/* The live region stays mounted so screen readers announce text added to it. */}
    <div role="status">{state.status === "saved" && <Notice>{m["profileEditor.saved"]}
      {savedLink && <> <a className={linkClass} href={savedLink.href}>{savedLink.label}</a></>}</Notice>}</div>
    {/* Focus moves here on failure, so no alert role is added to avoid a second announcement. */}
    {failed && <section ref={summary} tabIndex={-1} aria-labelledby={`${idPrefix}-problem`}
      className="space-y-3 rounded-lg border-2 border-red-800 bg-red-50 p-4 text-red-950">
      <h2 id={`${idPrefix}-problem`} className="text-lg font-semibold">{m["profileEditor.problem"]}</h2>
      <p>{message}</p>
      {invalidFields.length > 0 && <ul className="list-disc space-y-1 pl-5">
        {invalidFields.map(field => <li key={field.name}><a className={linkClass} href={`#${fieldId(field.name)}`}
          // Fragment navigation alone does not move focus into the field.
          onClick={event => { event.preventDefault(); document.getElementById(fieldId(field.name))?.focus(); }}>
          {field.label}: {fieldError(field.name)}</a></li>)}
      </ul>}
      {(state.status === "expired" || state.status === "signedOut") && <a className={linkClass} href={loginHref}>{m["account.login"]}</a>}
    </section>}
    {state.status === "conflict" && <section aria-labelledby={`${idPrefix}-latest`} className="space-y-3 rounded-lg border border-slate-400 p-4">
      <h2 id={`${idPrefix}-latest`} className="text-lg font-semibold text-teal-950">{m["profileEditor.latestHeading"]}</h2>
      {state.latest && <dl className="grid gap-1 [overflow-wrap:anywhere]">
        {fields.map(field => <div key={field.name}>
          <dt className="font-semibold">{field.label}</dt>
          <dd className={field.rows ? "whitespace-pre-line" : undefined}>{state.latest![field.name] || m["profileEditor.empty"]}</dd>
        </div>)}
      </dl>}
      <a className={linkClass} href={reloadHref}>{m["profileEditor.discard"]}</a>
    </section>}
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="version" value={version} />
      {fields.map(field => field.rows ?
        <TextAreaField key={field.name} id={fieldId(field.name)} name={field.name} label={field.label} hint={field.hint}
          defaultValue={state.values[field.name]} maxLength={field.maxLength} rows={field.rows} error={fieldError(field.name)} /> :
        <Field key={field.name} id={fieldId(field.name)} name={field.name} label={field.label} hint={field.hint}
          defaultValue={state.values[field.name]} maxLength={field.maxLength} autoComplete="off" error={fieldError(field.name)} />)}
      <div className="flex flex-wrap gap-4">
        <SubmitButton label={saveLabel} pendingLabel={m["profileEditor.saving"]} />
        {state.status === "conflict" && state.latest &&
          <SubmitButton name="overwriteVersion" value={String(state.latest.version)} className="border-2 border-teal-800 !bg-white !text-teal-950 hover:!bg-teal-50"
            label={m["profileEditor.overwrite"]} pendingLabel={m["profileEditor.saving"]} />}
      </div>
    </form>
  </div>;
}
