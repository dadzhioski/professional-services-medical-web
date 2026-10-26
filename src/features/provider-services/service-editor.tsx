"use client";

import { Field, TextAreaField } from "@/components/ui/presentation";
import type { RecordMessages } from "@/features/provider-records/form";
import { RecordEditor, linkClass, type RecordAction } from "@/features/provider-records/record-editor";
import { formatPrice } from "@/lib/price";
import { serviceLimits, type ServiceEditorState, type ServiceMessages, type ServiceValues } from "./fields";

export type LocationOption = { id: string; label: string };
const selectClass = "block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2";

export function ServiceEditor({ id, locale, action, initial, messages: m, recordMessages, currencies, locations, locationsHref,
  loginHref, reloadHref }: {
  id: string; locale: string; action: RecordAction<ServiceValues, ServiceValues>; initial: ServiceEditorState; messages: ServiceMessages;
  recordMessages: RecordMessages; currencies: readonly string[]; locations: LocationOption[]; locationsHref: string;
  loginHref: string; reloadHref: string;
}) {
  const labels = { name: m["providerServices.name"], description: m["providerServices.details"], amount: m["providerServices.amount"],
    currency: m["providerServices.currency"], locationIds: m["providerServices.locations"] };
  const locationLabel = (locationId: string) => locations.find(location => location.id === locationId)?.label ?? m["providerServices.locationUnknown"];
  return <RecordEditor id={id} action={action} initial={initial} messages={recordMessages} labels={labels} loginHref={loginHref}
    reloadHref={reloadHref} saveLabel={initial.version === undefined ? m["providerServices.create"] : m["providerServices.save"]}
    latest={latest => <dl className="grid gap-1 [overflow-wrap:anywhere]">
      <dt className="font-semibold">{labels.name}</dt><dd>{latest.name || recordMessages["records.empty"]}</dd>
      <dt className="font-semibold">{labels.description}</dt><dd className="whitespace-pre-line">{latest.description || recordMessages["records.empty"]}</dd>
      <dt className="font-semibold">{m["providerServices.price"]}</dt>
      <dd>{latest.priceMode === "price" ? formatPrice(locale, latest.amount, latest.currency) : m["providerServices.priceNotPublished"]}</dd>
      <dt className="font-semibold">{labels.locationIds}</dt>
      <dd>{latest.locationIds.length ? latest.locationIds.map(locationLabel).join("; ") : recordMessages["records.empty"]}</dd>
    </dl>}>
    {(state, error) => <>
      <Field id={`${id}-name`} name="name" label={labels.name} hint={m["providerServices.nameHint"]} defaultValue={state.values.name}
        maxLength={serviceLimits.name} required autoComplete="off" error={error("name")} />
      <TextAreaField id={`${id}-description`} name="description" label={labels.description} hint={m["providerServices.detailsHint"]}
        defaultValue={state.values.description} maxLength={serviceLimits.description} rows={4} error={error("description")} />
      <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">{m["providerServices.price"]}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="priceMode" value="none" defaultChecked={state.values.priceMode === "none"} className="size-5" />
          {m["providerServices.priceNone"]}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="priceMode" value="price" defaultChecked={state.values.priceMode === "price"} className="size-5" />
          {m["providerServices.priceSet"]}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Text input keeps the exact decimal string; number inputs can reformat or round. */}
          <Field id={`${id}-amount`} name="amount" label={labels.amount} hint={m["providerServices.amountHint"]} inputMode="decimal"
            defaultValue={state.values.amount} maxLength={10} autoComplete="off" error={error("amount")} />
          <div className="min-w-0 space-y-2">
            <label htmlFor={`${id}-currency`} className="block font-semibold">{labels.currency}</label>
            <select id={`${id}-currency`} name="currency" defaultValue={state.values.currency} className={selectClass}
              aria-invalid={error("currency") ? true : undefined} aria-describedby={error("currency") ? `${id}-currency-error` : undefined}>
              <option value="">{m["providerServices.currencyChoose"]}</option>
              {currencies.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
            {error("currency") && <p id={`${id}-currency-error`} className="font-medium text-red-800">{error("currency")}</p>}
          </div>
        </div>
      </fieldset>
      <fieldset id={`${id}-locationIds`} tabIndex={-1} className="min-w-0 space-y-3"
        aria-describedby={`${id}-locationIds-hint${error("locationIds") ? ` ${id}-locationIds-error` : ""}`}>
        <legend className="font-semibold">{labels.locationIds}</legend>
        <p id={`${id}-locationIds-hint`} className="text-sm text-slate-700">{m["providerServices.locationsHint"]}</p>
        {locations.length === 0 && <p><a className={linkClass} href={locationsHref}>{m["providerServices.locationsMissing"]}</a></p>}
        {locations.map(location => <label key={location.id} className="flex min-h-11 items-center gap-3 [overflow-wrap:anywhere]">
          <input type="checkbox" name="locationIds" value={location.id} defaultChecked={state.values.locationIds.includes(location.id)}
            className="size-5 shrink-0" />
          {location.label}
        </label>)}
        {error("locationIds") && <p id={`${id}-locationIds-error`} className="font-medium text-red-800">{error("locationIds")}</p>}
      </fieldset>
    </>}
  </RecordEditor>;
}
