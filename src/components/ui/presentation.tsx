import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Shared token-based classes (WEB-M1-019) so anchors and buttons styled alike stay identical.
export type ButtonVariant = "primary" | "secondary" | "danger";
const buttonBase = "inline-flex min-h-11 items-center justify-center rounded-pill px-6 py-2 text-center font-semibold "
  + "shadow-button transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-strong",
  secondary: "border border-control bg-surface text-ink hover:bg-tint",
  danger: "bg-danger text-white hover:bg-danger-strong",
};
export const buttonClass = (variant: ButtonVariant = "primary") => `${buttonBase} ${buttonVariants[variant]}`;
// Links stay underlined so they are distinguishable without colour.
export const linkClass = "inline-block py-2 font-semibold text-primary underline underline-offset-4 hover:text-primary-strong";
const controlBase = "block min-h-11 w-full rounded-input border bg-surface px-3 py-2 text-text";
// The error border is a supplement; the error text always says what is wrong.
export const controlClass = (invalid = false) => `${controlBase} ${invalid ? "border-danger" : "border-control"}`;
// The shared page column (WEB-M2-009 decision 2); readable stacks inside it stay at max-w-3xl.
export const pageContainerClass = "mx-auto w-full max-w-page px-4 sm:px-6";
// Provider, admin and status pages: the same column, with each block capped at a readable width.
export const readableMainClass = `${pageContainerClass} space-y-6 *:max-w-3xl`;
// Pill groups of plain links (language switch, review filters). The current link is filled (white on primary,
// 6.07:1); the others keep an underline so they read as links without colour.
export const pillGroupClass = "flex flex-wrap gap-1 rounded-pill border border-border bg-canvas p-1";
export const pillLinkClass = "inline-flex min-h-11 items-center rounded-pill px-3 text-primary underline underline-offset-4 "
  + "hover:bg-tint hover:text-primary-strong aria-[current=page]:bg-primary aria-[current=page]:font-semibold "
  + "aria-[current=page]:text-white aria-[current=page]:no-underline";
export const cardClass = "rounded-card border border-border bg-surface shadow-card";
export const errorTextClass = "font-medium text-danger";

export function Heading({ children, ...props }: ComponentPropsWithoutRef<"h1">) {
  return <h1 {...props} className="text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.5rem]">{children}</h1>;
}
export function Section({ id, title, children, level = 2 }: { id: string; title: string; children: ReactNode; level?: 2 | 3 | 4 }) {
  const Title = `h${level}` as const;
  return <section aria-labelledby={id} className={`min-w-0 space-y-4 p-6 sm:p-8 ${cardClass}`}>
    <Title id={id} className="text-[1.375rem] font-semibold leading-snug text-ink">{title}</Title>{children}
  </section>;
}
export function Notice({ children, role }: { children: ReactNode; role?: "alert" | "status" }) {
  return <p role={role} className="rounded-input border border-primary bg-tint p-4 text-ink">{children}</p>;
}
export function Button({ type = "button", variant = "primary", className = "", ...props }:
  ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={`${buttonClass(variant)} ${className}`} {...props} />;
}
type Described = { id: string; label: string; hint?: string; error?: string; "aria-describedby"?: string };
function FieldFrame({ id, label, hint, error, children }: Omit<Described, "aria-describedby"> & { children: ReactNode }) {
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-semibold text-ink">{label}</label>
    {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
    {children}
    {error && <p id={`${id}-error`} className={errorTextClass}>{error}</p>}
  </div>;
}
const describedBy = ({ id, hint, error, "aria-describedby": extra }: Described) =>
  [extra, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
type FieldProps = ComponentPropsWithoutRef<"input"> & Described;
export function Field({ id, label, hint, error, className = "", "aria-describedby": extra, ...props }: FieldProps) {
  return <FieldFrame id={id} label={label} hint={hint} error={error}>
    <input {...props} id={id} aria-describedby={describedBy({ id, label, hint, error, "aria-describedby": extra })}
      aria-invalid={error ? true : props["aria-invalid"]}
      className={`${controlClass(!!error)} ${className}`} />
  </FieldFrame>;
}
type TextAreaProps = ComponentPropsWithoutRef<"textarea"> & Described;
export function TextAreaField({ id, label, hint, error, className = "", "aria-describedby": extra, ...props }: TextAreaProps) {
  return <FieldFrame id={id} label={label} hint={hint} error={error}>
    <textarea {...props} id={id} aria-describedby={describedBy({ id, label, hint, error, "aria-describedby": extra })}
      aria-invalid={error ? true : props["aria-invalid"]}
      className={`${controlClass(!!error)} min-h-40 ${className}`} />
  </FieldFrame>;
}
