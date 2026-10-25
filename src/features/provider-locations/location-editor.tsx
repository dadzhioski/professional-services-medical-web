"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Field } from "@/components/ui/presentation";
import type { RecordMessages } from "@/features/provider-records/form";
import { RecordEditor, type RecordAction } from "@/features/provider-records/record-editor";
import { locationLimits, type LocationEditorState, type LocationMessages, type LocationValues } from "./fields";

export type CountryOption = { code: string; label: string; cities: { id: string; label: string }[] };
const selectClass = "block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2";

function Select({ id, label, hint, error, children, ...props }: { id: string; label: string; hint?: string; error?: string } &
  ComponentPropsWithoutRef<"select">) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-semibold">{label}</label>
    {hint && <p id={`${id}-hint`} className="text-sm text-slate-700">{hint}</p>}
    <select {...props} id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className={selectClass}>{children}</select>
    {error && <p id={`${id}-error`} className="font-medium text-red-800">{error}</p>}
  </div>;
}

// Cities are grouped by country so the form works without JavaScript; the API checks the pairing.
// A current city or country that is no longer listed stays selectable and is never silently replaced.
export function LocationEditor({ id, action, initial, messages: m, recordMessages, countries, loginHref, reloadHref }: {
  id: string; action: RecordAction<LocationValues, LocationValues>; initial: LocationEditorState; messages: LocationMessages;
  recordMessages: RecordMessages; countries: CountryOption[]; loginHref: string; reloadHref: string;
}) {
  const labels = { label: m["providerLocations.label"], countryCode: m["providerLocations.country"], cityId: m["providerLocations.city"],
    displayAddress: m["providerLocations.address"] };
  const current = initial.values;
  const listedCountry = countries.some(country => country.code === current.countryCode);
  const listedCity = countries.some(country => country.cities.some(city => city.id === current.cityId));
  const countryLabel = (code: string) => countries.find(country => country.code === code)?.label ?? code;
  const cityLabel = (cityId: string) => countries.flatMap(country => country.cities).find(city => city.id === cityId)?.label ??
    m["providerLocations.retired"];
  return <RecordEditor id={id} action={action} initial={initial} messages={recordMessages} labels={labels} loginHref={loginHref}
    reloadHref={reloadHref} saveLabel={initial.version === undefined ? m["providerLocations.create"] : m["providerLocations.save"]}
    latest={latest => <dl className="grid gap-1 [overflow-wrap:anywhere]">
      <dt className="font-semibold">{labels.label}</dt><dd>{latest.label || recordMessages["records.empty"]}</dd>
      <dt className="font-semibold">{labels.displayAddress}</dt><dd>{latest.displayAddress}</dd>
      <dt className="font-semibold">{labels.cityId}</dt><dd>{cityLabel(latest.cityId)}, {countryLabel(latest.countryCode)}</dd>
    </dl>}>
    {(state, error) => <>
      <Field id={`${id}-label`} name="label" label={labels.label} hint={m["providerLocations.labelHint"]} defaultValue={state.values.label}
        maxLength={locationLimits.label} autoComplete="organization" error={error("label")} />
      <Field id={`${id}-displayAddress`} name="displayAddress" label={labels.displayAddress} hint={m["providerLocations.addressHint"]}
        defaultValue={state.values.displayAddress} maxLength={locationLimits.displayAddress} required autoComplete="off"
        error={error("displayAddress")} />
      <Select id={`${id}-countryCode`} name="countryCode" label={labels.countryCode} defaultValue={state.values.countryCode}
        required error={error("countryCode")}>
        <option value="">{m["providerLocations.choose"]}</option>
        {!listedCountry && current.countryCode && <option value={current.countryCode}>{current.countryCode}</option>}
        {countries.map(country => <option key={country.code} value={country.code}>{country.label}</option>)}
      </Select>
      <Select id={`${id}-cityId`} name="cityId" label={labels.cityId} hint={m["providerLocations.cityHint"]} defaultValue={state.values.cityId}
        required error={error("cityId")}>
        <option value="">{m["providerLocations.choose"]}</option>
        {!listedCity && current.cityId && <option value={current.cityId}>{m["providerLocations.retired"]}</option>}
        {countries.filter(country => country.cities.length).map(country => <optgroup key={country.code} label={country.label}>
          {country.cities.map(city => <option key={city.id} value={city.id}>{city.label}</option>)}
        </optgroup>)}
      </Select>
    </>}
  </RecordEditor>;
}
