"use client";

import { Field } from "@/components/ui/presentation";
import type { RecordMessages } from "@/features/provider-records/form";
import { RecordEditor, type RecordAction } from "@/features/provider-records/record-editor";
import { credentialLimits, type CredentialEditorState, type CredentialMessages, type CredentialValues } from "./fields";
import { credentialTypeKey } from "./labels";

const selectClass = "block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2";

export function CredentialEditor({ id, action, initial, messages: m, recordMessages, types, loginHref, reloadHref }: {
  id: string; action: RecordAction<CredentialValues, CredentialValues>; initial: CredentialEditorState; messages: CredentialMessages;
  recordMessages: RecordMessages; types: readonly string[]; loginHref: string; reloadHref: string;
}) {
  const labels = { type: m["credential.type"], title: m["credentials.title"], issuer: m["credentials.issuer"],
    issuedOn: m["credentials.issuedOn"], expiresOn: m["credentials.expiresOn"] };
  const typeLabel = (type: string) => m[credentialTypeKey(type)];
  return <RecordEditor id={id} action={action} initial={initial} messages={recordMessages} labels={labels} loginHref={loginHref}
    reloadHref={reloadHref} saveLabel={initial.version === undefined ? m["credentials.create"] : m["credentials.save"]}
    latest={latest => <dl className="grid gap-1 [overflow-wrap:anywhere]">
      <dt className="font-semibold">{labels.type}</dt><dd>{typeLabel(latest.type)}</dd>
      <dt className="font-semibold">{labels.title}</dt><dd>{latest.title}</dd>
      <dt className="font-semibold">{labels.issuer}</dt><dd>{latest.issuer}</dd>
      <dt className="font-semibold">{labels.issuedOn}</dt><dd>{latest.issuedOn}</dd>
      <dt className="font-semibold">{labels.expiresOn}</dt><dd>{latest.expiresOn || m["credentials.noExpiry"]}</dd>
    </dl>}>
    {(state, error) => <>
      <div className="min-w-0 space-y-2">
        <label htmlFor={`${id}-type`} className="block font-semibold">{labels.type}</label>
        <select id={`${id}-type`} name="type" defaultValue={state.values.type} required className={selectClass}
          aria-invalid={error("type") ? true : undefined} aria-describedby={error("type") ? `${id}-type-error` : undefined}>
          <option value="">{m["credentials.typeChoose"]}</option>
          {types.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
        </select>
        {error("type") && <p id={`${id}-type-error`} className="font-medium text-red-800">{error("type")}</p>}
      </div>
      <Field id={`${id}-title`} name="title" label={labels.title} hint={m["credentials.titleHint"]} defaultValue={state.values.title}
        maxLength={credentialLimits.title} required autoComplete="off" error={error("title")} />
      <Field id={`${id}-issuer`} name="issuer" label={labels.issuer} hint={m["credentials.issuerHint"]} defaultValue={state.values.issuer}
        maxLength={credentialLimits.issuer} required autoComplete="off" error={error("issuer")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-issuedOn`} name="issuedOn" type="date" label={labels.issuedOn} hint={m["credentials.issuedOnHint"]}
          defaultValue={state.values.issuedOn} required error={error("issuedOn")} />
        <Field id={`${id}-expiresOn`} name="expiresOn" type="date" label={labels.expiresOn} hint={m["credentials.expiresOnHint"]}
          defaultValue={state.values.expiresOn} error={error("expiresOn")} />
      </div>
    </>}
  </RecordEditor>;
}
