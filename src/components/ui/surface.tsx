import type { ComponentPropsWithoutRef } from "react";

export function Surface({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`rounded-xl border border-slate-300 bg-white p-6 sm:p-10 ${className}`} {...props} />;
}
