"use client";

import { useState, type ChangeEvent } from "react";
import { imageAccept, imageLimits } from "./limits";

// A usability hint only: the browser blocks obviously unsuitable files before upload, and the API
// still validates the real content. Without JavaScript the server reports the same problems.
export function ImageInput({ id, name, label, hint, tooLarge, unsupported }: {
  id: string; name: string; label: string; hint: string; tooLarge: string; unsupported: string;
}) {
  const [error, setError] = useState("");
  function check(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // An empty type means the browser could not tell; the API detects the content itself.
    const message = !file ? "" : file.type && !(imageLimits.types as readonly string[]).includes(file.type) ? unsupported :
      file.size > imageLimits.maxBytes ? tooLarge : "";
    event.currentTarget.setCustomValidity(message);
    setError(message);
  }
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-semibold">{label}</label>
    <p id={`${id}-hint`} className="text-sm text-slate-700">{hint}</p>
    <input id={id} name={name} type="file" accept={imageAccept} required onChange={check}
      aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`} aria-invalid={error ? true : undefined}
      className="block w-full min-h-11 rounded-lg border border-slate-500 bg-white px-3 py-2" />
    {error && <p id={`${id}-error`} role="alert" className="font-medium text-red-800">{error}</p>}
  </div>;
}
