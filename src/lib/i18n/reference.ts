import type { Locale } from ".";

type Labels = { mk?: string | null; en?: string | null; bg?: string | null } | null | undefined;

// API reference labels exist for mk, en and bg only. Other locales show the stable code (owner decision
// 2026-10-22); no translations are invented here.
export function referenceLabel(labels: Labels, code: string, locale: Locale): string {
  if (locale === "sq") return code;
  const label = labels?.[locale];
  return typeof label === "string" && label.trim() ? label : code;
}
