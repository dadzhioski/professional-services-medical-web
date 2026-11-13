import type { TranslationKey } from "@/lib/i18n/en";
import { identifierPattern, text, versions, type RecordState } from "@/features/provider-records/form";

// Only the specialty reference is edited here; licence and registration details belong to WEB-M1-009.
export type SpecialtyValues = { specialtyId: string };
export type SpecialtyEditorState = RecordState<SpecialtyValues>;

export const specialtyMessageKeys = [
  "specialtyEditor.label", "specialtyEditor.hint", "specialtyEditor.none", "specialtyEditor.retired",
  "specialtyEditor.save", "specialtyEditor.saved",
] as const satisfies readonly TranslationKey[];
export type SpecialtyMessages = Record<(typeof specialtyMessageKeys)[number], string>;

// The API's stable reference ID is the identity; an empty value clears the specialty.
export function readSpecialtyForm(form: FormData) {
  const values: SpecialtyValues = { specialtyId: text(form, "specialtyId") };
  const errors: SpecialtyEditorState["errors"] = {};
  if (values.specialtyId && !identifierPattern.test(values.specialtyId)) errors.specialtyId = "format";
  return { values, errors, ...versions(form) };
}
