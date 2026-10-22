"use client";

import type { RecordMessages } from "@/features/provider-records/form";
import { RecordEditor, type RecordAction } from "@/features/provider-records/record-editor";
import type { SpecialtyEditorState, SpecialtyMessages, SpecialtyValues } from "./specialty";

export type SpecialtyOption = { id: string; label: string };

// A current specialty that is no longer offered stays selected until the provider changes it.
export function SpecialtyEditor({ action, initial, messages: m, recordMessages, specialties, loginHref, reloadHref }: {
  action: RecordAction<SpecialtyValues, SpecialtyValues>; initial: SpecialtyEditorState; messages: SpecialtyMessages;
  recordMessages: RecordMessages; specialties: SpecialtyOption[]; loginHref: string; reloadHref: string;
}) {
  const labelOf = (id: string) => !id ? m["specialtyEditor.none"] :
    specialties.find(option => option.id === id)?.label ?? m["specialtyEditor.retired"];
  return <RecordEditor id="specialty" action={action} initial={initial} messages={recordMessages}
    labels={{ specialtyId: m["specialtyEditor.label"] }} loginHref={loginHref} reloadHref={reloadHref}
    saveLabel={m["specialtyEditor.save"]} savedLabel={m["specialtyEditor.saved"]}
    latest={latest => <p>{labelOf(latest.specialtyId)}</p>}>
    {(state, error) => {
      const current = state.values.specialtyId;
      const retired = current && !specialties.some(option => option.id === current);
      return <div className="min-w-0 space-y-2">
        <label htmlFor="specialty-specialtyId" className="block font-semibold">{m["specialtyEditor.label"]}</label>
        <p id="specialty-specialtyId-hint" className="text-sm text-slate-700">{m["specialtyEditor.hint"]}</p>
        <select id="specialty-specialtyId" name="specialtyId" defaultValue={current} aria-invalid={error("specialtyId") ? true : undefined}
          aria-describedby={`specialty-specialtyId-hint${error("specialtyId") ? " specialty-specialtyId-error" : ""}`}
          className="block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2">
          <option value="">{m["specialtyEditor.none"]}</option>
          {retired && <option value={current}>{m["specialtyEditor.retired"]}</option>}
          {specialties.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        {error("specialtyId") && <p id="specialty-specialtyId-error" className="font-medium text-red-800">{error("specialtyId")}</p>}
      </div>;
    }}
  </RecordEditor>;
}
