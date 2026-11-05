import type { ComponentPropsWithoutRef } from "react";
import { cardClass } from "./presentation";

export function Surface({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`${cardClass} p-6 sm:p-10 ${className}`} {...props} />;
}
