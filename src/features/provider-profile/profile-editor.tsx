"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Notice, TextAreaField } from "@/components/ui/presentation";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import type { SavedLink } from "@/features/provider-records/record-editor";
import { profileLimits, type EditorMessages, type EditorState, type ProfileField } from "./fields";

type SaveAction = (previous: EditorState, form: FormData) => Promise<EditorState>;
const labels = { displayName: "profileEditor.displayName", biography: "profileEditor.biography" } as const;
const linkClass = "font-semibold text-blue-800 underline underline-offset-4";

export function ProfileEditor({ action, initial, messages: m, loginHref, reloadHref, savedLink }: {
  action: SaveAction; initial: EditorState; messages: EditorMessages; loginHref: string; reloadHref: string; savedLink?: SavedLink;
}) {
  const [state, formAction] = useActionState(action, initial);
  const summary = useRef<HTMLElement>(null);
  // Move keyboard focus to the error summary whenever a submission fails.
  useEffect(() => {
    if (state !== initial && state.status !== "saved") summary.current?.focus();
  }, [state, initial]);
  const failed = state.status !== "idle" && state.status !== "saved";
  const invalidFields = (Object.keys(labels) as ProfileField[]).filter(field => state.errors[field]);
  const status = state.status;
  const message = status === "invalid" ? m["profileEditor.invalid"] : status === "conflict" ? m["profileEditor.conflict"] :
    status === "idle" || status === "saved" ? undefined : `${m[`account.${status}`]} ${m["profileEditor.keptInput"]}`;
  const fieldError = (field: ProfileField) => state.errors[field] ? m["profileEditor.tooLong"] : undefined;
  return <div className="space-y-6">
    {/* The live region stays mounted so screen readers announce text added to it. */}
    <div role="status">{state.status === "saved" && <Notice>{m["profileEditor.saved"]}
      {savedLink && <> <a className={linkClass} href={savedLink.href}>{savedLink.label}</a></>}</Notice>}</div>
    {/* Focus moves here on failure, so no alert role is added to avoid a second announcement. */}
    {failed && <section ref={summary} tabIndex={-1} aria-labelledby="profile-problem"
      className="space-y-3 rounded-lg border-2 border-red-800 bg-red-50 p-4 text-red-950">
      <h2 id="profile-problem" className="text-lg font-semibold">{m["profileEditor.problem"]}</h2>
      <p>{message}</p>
      {invalidFields.length > 0 && <ul className="list-disc space-y-1 pl-5">
        {invalidFields.map(field => <li key={field}><a className={linkClass} href={`#profile-${field}`}
          // Fragment navigation alone does not move focus into the field.
          onClick={event => { event.preventDefault(); document.getElementById(`profile-${field}`)?.focus(); }}>
          {m[labels[field]]}: {fieldError(field)}</a></li>)}
      </ul>}
      {(state.status === "expired" || state.status === "signedOut") && <a className={linkClass} href={loginHref}>{m["account.login"]}</a>}
    </section>}
    {state.status === "conflict" && <section aria-labelledby="profile-latest" className="space-y-3 rounded-lg border border-slate-400 p-4">
      <h2 id="profile-latest" className="text-lg font-semibold text-teal-950">{m["profileEditor.latestHeading"]}</h2>
      {state.latest && <dl className="grid gap-1 [overflow-wrap:anywhere]">
        <dt className="font-semibold">{m["profileEditor.displayName"]}</dt>
        <dd>{state.latest.displayName || m["profileEditor.empty"]}</dd>
        <dt className="font-semibold">{m["profileEditor.biography"]}</dt>
        <dd className="whitespace-pre-line">{state.latest.biography || m["profileEditor.empty"]}</dd>
      </dl>}
      <a className={linkClass} href={reloadHref}>{m["profileEditor.discard"]}</a>
    </section>}
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="version" value={state.version} />
      <Field id="profile-displayName" name="displayName" label={m["profileEditor.displayName"]} hint={m["profileEditor.displayNameHint"]}
        defaultValue={state.values.displayName} maxLength={profileLimits.displayName} autoComplete="off" error={fieldError("displayName")} />
      <TextAreaField id="profile-biography" name="biography" label={m["profileEditor.biography"]} hint={m["profileEditor.biographyHint"]}
        defaultValue={state.values.biography} maxLength={profileLimits.biography} rows={8} error={fieldError("biography")} />
      <div className="flex flex-wrap gap-4">
        <SubmitButton label={m["profileEditor.save"]} pendingLabel={m["profileEditor.saving"]} />
        {state.status === "conflict" && state.latest &&
          <SubmitButton name="overwriteVersion" value={String(state.latest.version)} className="border-2 border-teal-800 !bg-white !text-teal-950 hover:!bg-teal-50"
            label={m["profileEditor.overwrite"]} pendingLabel={m["profileEditor.saving"]} />}
      </div>
    </form>
  </div>;
}
