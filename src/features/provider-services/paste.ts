import { serviceLimits, type PriceRow } from "./fields";

// Currency words doctors write after a price; anything else falls back to the list's currency.
const currencyWords: [RegExp, string][] = [[/^(?:ден\.?|денари|денара|den\.?|mkd)$/iu, "MKD"], [/^(?:€|eur|euro?|евра?|евро)$/iu, "EUR"]];
const bullet = /^\s*(?:[-–—•*·]+|\d{1,3}[.)])\s+/u;
// A trailing amount: thousands grouped by space, dot or comma, an optional 1–2 digit decimal part, then an
// optional currency word. The name keeps everything before it, minus separators such as dashes or colons.
const price = /^(.*?)[\s:|–—-]*(\d{1,3}(?:[ ., ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(€|[\p{L}]+\.?)?\s*$/u;

function parseLine(line: string, fallbackCurrency: string): PriceRow | undefined {
  const cleaned = line.replace(bullet, "").trim();
  if (!cleaned) return undefined;
  const entry = { description: "", remove: false, currency: fallbackCurrency };
  // The pattern backtracks on long lines; a line longer than any valid name plus a price is never parsed.
  if (cleaned.length > serviceLimits.name + 40) return { ...entry, name: cleaned, amount: "" };
  const match = price.exec(cleaned);
  const currency = match?.[4] && currencyWords.find(([word]) => word.test(match[4]!))?.[1];
  const name = match?.[1].replace(/[\s:|–—-]+$/u, "").trim();
  // An unknown trailing word means the number is part of the name (for example "Holter 24 hours").
  if (!match || !name || (match[4] && !currency)) return { ...entry, name: cleaned, amount: "" };
  const whole = match[2].replace(/[ ., ]/g, "").replace(/^0+(?=\d)/, "");
  return { ...entry, name, amount: match[3] ? `${whole}.${match[3]}` : whole, currency: currency || fallbackCurrency };
}

// One entry per non-empty line, as unsaved rows the doctor reviews before saving; never more than the API allows.
export function parsePriceList(text: string, fallbackCurrency: string) {
  return text.split(/\r\n?|\n/).map(line => parseLine(line, fallbackCurrency))
    .filter((row): row is PriceRow => !!row).slice(0, serviceLimits.entries);
}
