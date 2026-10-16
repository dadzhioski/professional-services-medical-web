import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Heading({ children, ...props }: ComponentPropsWithoutRef<"h1">) {
  return <h1 {...props} className="text-3xl font-bold tracking-tight text-teal-950 sm:text-4xl">{children}</h1>;
}
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="min-w-0 space-y-4 rounded-xl border border-slate-300 bg-white p-6 sm:p-8">
    <h2 id={id} className="text-xl font-semibold text-teal-950">{title}</h2>{children}
  </section>;
}
export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-teal-700 bg-teal-50 p-4 text-teal-950">{children}</p>;
}
export function Button({ type = "button", className = "", ...props }: ComponentPropsWithoutRef<"button">) {
  return <button type={type} className={`min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 ${className}`} {...props} />;
}
type FieldProps = ComponentPropsWithoutRef<"input"> & { id: string; label: string; hint?: string; error?: string };
export function Field({ id, label, hint, error, className = "", "aria-describedby": describedBy, ...props }: FieldProps) {
  const description = [describedBy, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-semibold">{label}</label>
    {hint && <p id={`${id}-hint`} className="text-sm text-slate-700">{hint}</p>}
    <input {...props} id={id} aria-describedby={description} aria-invalid={error ? true : props["aria-invalid"]}
      className={`block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 ${className}`} />
    {error && <p id={`${id}-error`} className="font-medium text-red-800">{error}</p>}
  </div>;
}
