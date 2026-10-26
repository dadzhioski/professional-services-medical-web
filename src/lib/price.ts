// The published 0.3.0 Price.amount pattern, shared by server validation and client-side form checks.
// Amounts stay decimal strings end to end: no Number conversion, so precision is never lost.
export const amountPattern = /^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/;

// Intl formats decimal strings exactly (no float conversion); unknown currencies fall back to the raw values.
export function formatPrice(locale: string, amount: string, currency: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount as Intl.StringNumericLiteral);
  } catch { return `${amount} ${currency}`; }
}
