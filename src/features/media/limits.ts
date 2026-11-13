// From the published 0.7.0 uploadMedia and credential contracts. These limits only help users before
// upload; the API detects the real content type and dimensions and remains authoritative.
export const imageLimits = {
  maxBytes: 10_485_760,
  types: ["image/jpeg", "image/png"],
  maxEvidence: 5,
} as const;

export const imageAccept = imageLimits.types.join(",");
