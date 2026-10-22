// The published 0.3.0 Price.amount pattern, shared by server validation and client-side form checks.
// Amounts stay decimal strings end to end: no Number conversion, so precision is never lost.
export const amountPattern = /^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/;
