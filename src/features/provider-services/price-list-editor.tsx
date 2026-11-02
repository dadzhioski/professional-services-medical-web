"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { Field, Notice, TextAreaField } from "@/components/ui/presentation";
import type { RecordMessages } from "@/features/provider-records/form";
import { linkClass } from "@/features/provider-records/record-editor";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import { formatPrice } from "@/lib/price";
import { serviceLimits, type PriceListState, type PriceListStatus, type PriceRow, type RowField, type ServiceMessages } from "./fields";

type Action = (previous: PriceListState, form: FormData) => Promise<PriceListState>;
const selectClass = "block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2";
const secondaryClass = "border-2 border-teal-800 !bg-white !text-teal-950 hover:!bg-teal-50";
const informational: PriceListStatus[] = ["idle", "imported", "importedNone"];
const fields: RowField[] = ["name", "amount", "currency", "description"];

// The whole price list is one form, so it works without JavaScript; rows are numbered by position and the server
// action re-reads the API list before deciding which rows to create, update or delete.
export function PriceListEditor({ id, locale, action, initial, messages: m, recordMessages: r, currencies, defaultCurrency,
  suggestion, loginHref, reloadHref }: {
  id: string; locale: string; action: Action; initial: PriceListState; messages: ServiceMessages; recordMessages: RecordMessages;
  currencies: readonly string[]; defaultCurrency: string; suggestion?: string; loginHref: string; reloadHref: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  // React resets forms after an action; each result remounts the rows with the echoed values as their defaults.
  const [result, setResult] = useState({ state, key: 0 });
  if (result.state !== state) setResult({ state, key: result.key + 1 });
  const summary = useRef<HTMLElement>(null);
  const focused = useRef(state);
  useEffect(() => {
    if (focused.current === state) return;
    focused.current = state;
    if (!informational.includes(state.status)) summary.current?.focus();
  }, [state]);

  const status = state.status;
  const room = serviceLimits.entries - state.rows.length;
  const blank = (index: number): PriceRow => ({ name: index === 0 && state.rows.length === 0 && suggestion ? suggestion : "",
    description: "", amount: "", currency: defaultCurrency, remove: false });
  const rows = [...state.rows, ...Array.from({ length: Math.max(0, Math.min(state.blanks, room)) }, (_, index) => blank(index))];
  const labels: Record<RowField, string> = { name: m["providerServices.name"], amount: m["providerServices.amount"],
    currency: m["providerServices.currency"], description: m["providerServices.details"] };
  const fieldId = (index: number, field: RowField) => `${id}-${index}-${field}`;
  const error = (index: number, field: RowField) => {
    const kind = state.errors[index]?.[field];
    return kind && r[`records.error.${kind}`];
  };
  const entry = (index: number) => `${m["providerServices.entry"]} ${index + 1}`;
  // Every row repeats the same labels, so each control also names its row for field lists and voice control.
  const named = (index: number, field: RowField) => `${labels[field]}, ${entry(index)}`;
  const priceText = (amount?: string, currency?: string) => amount && currency ? formatPrice(locale, amount, currency) :
    m["providerServices.priceOnRequest"];
  const message = status === "invalid" ? r["records.invalid"] : status === "partial" ? m["providerServices.partial"] :
    status === "tooMany" ? m["providerServices.tooMany"] : status === "pastePending" ? m["providerServices.pastePending"] : informational.includes(status) ? undefined :
      `${r[`account.${status as "signedOut"}`]} ${r["records.keptInput"]}`;
  const outcomeText = (index: number) => {
    const outcome = state.outcomes[index];
    if (!outcome) return undefined;
    if (outcome.outcome === "rejected") return m["providerServices.rowRejected"];
    if (outcome.outcome === "removedElsewhere") return m["providerServices.rowRemovedElsewhere"];
    return outcome.latest ? `${m["providerServices.rowConflict"]} ${m["providerServices.rowLatest"]} ${outcome.latest.name} — ${
      priceText(outcome.latest.amount, outcome.latest.currency)}${outcome.latest.description ? `. ${outcome.latest.description}` : ""}. ${m["providerServices.rowOverwrite"]}` : m["providerServices.rowConflict"];
  };
  // Fragment navigation alone does not move focus into the field.
  const focusLink = (target: string, label: string) => <a className={linkClass} href={`#${target}`}
    onClick={event => { event.preventDefault(); document.getElementById(target)?.focus(); }}>{label}</a>;

  return <div className="space-y-6">
    {/* The live region stays mounted so screen readers announce text added to it. */}
    <div role="status">{(status === "imported" || status === "importedNone") &&
      <Notice>{m[`providerServices.${status}`]}</Notice>}</div>
    {/* Focus moves here on failure, so no alert role is added to avoid a second announcement. */}
    {message && <section ref={summary} tabIndex={-1} aria-labelledby={`${id}-problem`}
      className="space-y-3 rounded-lg border-2 border-red-800 bg-red-50 p-4 text-red-950">
      <h3 id={`${id}-problem`} className="text-lg font-semibold">{r["records.problem"]}</h3>
      <p>{message}</p>
      {(Object.keys(state.errors).length > 0 || Object.keys(state.outcomes).length > 0) && <ul className="list-disc space-y-1 pl-5">
        {state.rows.map((_, index) => <Fragment key={index}>
          {fields.filter(field => error(index, field)).map(field => <li key={field}>
            {focusLink(fieldId(index, field), `${entry(index)}, ${labels[field]}: ${error(index, field)}`)}</li>)}
          {state.outcomes[index] && <li>{focusLink(fieldId(index, "name"), `${entry(index)}: ${outcomeText(index)}`)}</li>}
        </Fragment>)}
      </ul>}
      {(status === "expired" || status === "signedOut") && <a className={linkClass} href={loginHref}>{r["account.login"]}</a>}
      {Object.values(state.outcomes).some(outcome => outcome.outcome === "conflict" && !outcome.latest) &&
        <a className={linkClass} href={reloadHref}>{r["records.discard"]}</a>}
    </section>}
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="rows" value={rows.length} />
      <p className="text-sm text-slate-700">{m["providerServices.rowsHint"]}</p>
      <ol key={result.key} className="space-y-4">
        {rows.map((row, index) => {
          const outcome = outcomeText(index);
          return <li key={index}>
            <fieldset className="min-w-0 space-y-4 rounded-lg border border-slate-300 p-4 [overflow-wrap:anywhere]"
              aria-describedby={outcome ? `${id}-${index}-outcome` : undefined}>
              <legend className="px-1 font-semibold text-teal-950">{entry(index)}</legend>
              {index === state.rows.length && row.name && <input type="hidden" name={`suggested-${index}`} value={row.name} />}
              {row.serviceId !== undefined && <>
                <input type="hidden" name={`serviceId-${index}`} value={row.serviceId} />
                <input type="hidden" name={`version-${index}`} value={row.version} />
              </>}
              {outcome && <p id={`${id}-${index}-outcome`} className="font-medium text-red-800">{outcome}</p>}
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]">
                <Field id={fieldId(index, "name")} name={`name-${index}`} label={labels.name} aria-label={named(index, "name")} defaultValue={row.name}
                  maxLength={serviceLimits.name} autoComplete="off" error={error(index, "name")} />
                {/* Text input keeps the exact decimal string; number inputs can reformat or round. */}
                <Field id={fieldId(index, "amount")} name={`amount-${index}`} label={labels.amount} aria-label={named(index, "amount")} inputMode="decimal"
                  defaultValue={row.amount} maxLength={10} autoComplete="off" error={error(index, "amount")} />
                <div className="min-w-0 space-y-2">
                  <label htmlFor={fieldId(index, "currency")} className="block font-semibold">{labels.currency}</label>
                  <select id={fieldId(index, "currency")} name={`currency-${index}`} defaultValue={row.currency || defaultCurrency}
                    aria-label={named(index, "currency")} className={selectClass} aria-invalid={error(index, "currency") ? true : undefined}
                    aria-describedby={error(index, "currency") ? `${fieldId(index, "currency")}-error` : undefined}>
                    {currencies.map(code => <option key={code} value={code}>{code}</option>)}
                  </select>
                  {error(index, "currency") &&
                    <p id={`${fieldId(index, "currency")}-error`} className="font-medium text-red-800">{error(index, "currency")}</p>}
                </div>
              </div>
              <details open={!!row.description || !!error(index, "description")} className="space-y-3">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-blue-800">{labels.description}</summary>
                <TextAreaField id={fieldId(index, "description")} name={`description-${index}`} label={labels.description}
                  aria-label={named(index, "description")} hint={m["providerServices.detailsHint"]} defaultValue={row.description} maxLength={serviceLimits.description}
                  rows={3} error={error(index, "description")} />
              </details>
              {row.serviceId !== undefined && <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name={`remove-${index}`} defaultChecked={row.remove} className="size-5 shrink-0" />
                {m["providerServices.remove"]}<span className="sr-only">, {entry(index)}</span>
              </label>}
            </fieldset>
          </li>;
        })}
      </ol>
      {/* Save comes first so Enter in a row submits the list rather than adding rows. */}
      <div className="flex flex-wrap gap-4">
        <SubmitButton label={m["providerServices.save"]} pendingLabel={r["records.saving"]} />
        {room > rows.length - state.rows.length && <SubmitButton name="intent" value="more" className={secondaryClass}
          label={m["providerServices.more"]} pendingLabel={r["records.saving"]} />}
      </div>
      <section aria-labelledby={`${id}-paste-heading`} className="space-y-4 border-t border-slate-300 pt-6">
        <h3 id={`${id}-paste-heading`} className="text-lg font-semibold text-teal-950">{m["providerServices.pasteHeading"]}</h3>
        <TextAreaField key={result.key} id={`${id}-paste`} name="paste" label={m["providerServices.pasteLabel"]}
          hint={m["providerServices.pasteHint"]} defaultValue={state.paste} maxLength={serviceLimits.paste} />
        <SubmitButton name="intent" value="import" className={secondaryClass} label={m["providerServices.pasteAdd"]}
          pendingLabel={r["records.saving"]} />
      </section>
    </form>
  </div>;
}
