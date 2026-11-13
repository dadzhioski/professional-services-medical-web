"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/presentation";

// Prevents repeated submissions while pending; API idempotency still covers retries.
export function SubmitButton({ label, pendingLabel, ...props }: { label: string; pendingLabel: string; variant?: ButtonVariant } &
  Omit<ComponentPropsWithoutRef<"button">, "type" | "disabled" | "children">) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={pending} aria-busy={pending}>{pending ? pendingLabel : label}</Button>;
}
