"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/presentation";

// Prevents repeated submissions while pending; API idempotency still covers retries.
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? pendingLabel : label}</Button>;
}
