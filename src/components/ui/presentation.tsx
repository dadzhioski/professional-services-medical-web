import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Heading({ children, ...props }: ComponentPropsWithoutRef<"h1">) {
  return <h1 {...props} className="text-3xl font-bold tracking-tight text-teal-950 sm:text-4xl">{children}</h1>;
}
export function Section({ id, title, children, level = 2 }: { id: string; title: string; children: ReactNode; level?: 2 | 3 | 4 }) {
  const Title = `h${level}` as const;
  return <section aria-labelledby={id} className="min-w-0 space-y-4 rounded-xl border border-slate-300 bg-white p-6 sm:p-8">
    <Title id={id} className="text-xl font-semibold text-teal-950">{title}</Title>{children}
  </section>;
}
export function Notice({ children, role }: { children: ReactNode; role?: "alert" | "status" }) {
  return <p role={role} className="rounded-lg border border-teal-700 bg-teal-50 p-4 text-teal-950">{children}</p>;
}
export function Button({ type = "button", className = "", ...props }: ComponentPropsWithoutRef<"button">) {
  return <button type={type} className={`min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 ${className}`} {...props} />;
}
type Described = { id: string; label: string; hint?: string; error?: string; "aria-describedby"?: string };
function FieldFrame({ id, label, hint, error, children }: Omit<Described, "aria-describedby"> & { children: ReactNode }) {
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-semibold">{label}</label>
    {hint && <p id={`${id}-hint`} className="text-sm text-slate-700">{hint}</p>}
    {children}
    {error && <p id={`${id}-error`} className="font-medium text-red-800">{error}</p>}
  </div>;
}
const describedBy = ({ id, hint, error, "aria-describedby": extra }: Described) =>
  [extra, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
type FieldProps = ComponentPropsWithoutRef<"input"> & Described;
export function Field({ id, label, hint, error, className = "", "aria-describedby": extra, ...props }: FieldProps) {
  return <FieldFrame id={id} label={label} hint={hint} error={error}>
    <input {...props} id={id} aria-describedby={describedBy({ id, label, hint, error, "aria-describedby": extra })}
      aria-invalid={error ? true : props["aria-invalid"]}
      className={`block min-h-11 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 ${className}`} />
  </FieldFrame>;
}
type TextAreaProps = ComponentPropsWithoutRef<"textarea"> & Described;
export function TextAreaField({ id, label, hint, error, className = "", "aria-describedby": extra, ...props }: TextAreaProps) {
  return <FieldFrame id={id} label={label} hint={hint} error={error}>
    <textarea {...props} id={id} aria-describedby={describedBy({ id, label, hint, error, "aria-describedby": extra })}
      aria-invalid={error ? true : props["aria-invalid"]}
      className={`block min-h-40 w-full rounded-lg border border-slate-500 bg-white px-3 py-2 ${className}`} />
  </FieldFrame>;
}
