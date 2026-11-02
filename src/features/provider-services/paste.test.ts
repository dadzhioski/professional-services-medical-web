import { expect, test } from "vitest";
import { parsePriceList } from "./paste";

const parsed = (text: string) => parsePriceList(text, "MKD").map(({ name, amount, currency }) => [name, amount, currency]);

test.each([
  ["Ехо на абдомен – 1500 ден", ["Ехо на абдомен", "1500", "MKD"]],
  ["Консултација: 1.500,00 ден.", ["Консултација", "1500.00", "MKD"]],
  ["- Holter EKG 24h 2 500 денари", ["Holter EKG 24h", "2500", "MKD"]],
  ["1. Контролен преглед 800", ["Контролен преглед", "800", "MKD"]],
  ["• Ultrasound | 45.50 EUR", ["Ultrasound", "45.50", "EUR"]],
  ["ECG 12 leads\t30€", ["ECG 12 leads", "30", "EUR"]],
  ["Specialist exam 1,500", ["Specialist exam", "1500", "MKD"]],
  ["Free check 0", ["Free check", "0", "MKD"]],
  ["Преглед 0500 евра", ["Преглед", "500", "EUR"]],
])("%s", (line, expected) => {
  expect(parsed(line)).toEqual([expected]);
});
test("lines without a recognizable price keep the whole line as the name", () => {
  expect(parsed("Holter 24 hours\n1500\nПрв преглед")).toEqual([["Holter 24 hours", "", "MKD"], ["1500", "", "MKD"], ["Прв преглед", "", "MKD"]]);
});
test("empty lines are skipped, CRLF is accepted and the API maximum is respected", () => {
  expect(parsed("\r\n  \r\nA 10\r\n\nB 20")).toEqual([["A", "10", "MKD"], ["B", "20", "MKD"]]);
  expect(parsePriceList(Array.from({ length: 60 }, (_, index) => `Entry ${index} 100`).join("\n"), "EUR")).toHaveLength(50);
});
test("pasted text stays inert and out-of-range amounts are left for validation", () => {
  expect(parsed('<script>alert("x")</script> 10')).toEqual([['<script>alert("x")</script>', "10", "MKD"]]);
  expect(parsed("Huge 99999999")).toEqual([["Huge", "99999999", "MKD"]]);
});
test("long lines are never run through the price pattern", () => {
  const started = performance.now();
  const rows = parsePriceList(["1".repeat(19998) + "x!", "a" + " ".repeat(19998) + "a"].join("\n"), "MKD");
  expect(performance.now() - started).toBeLessThan(100);
  expect(rows.map(row => row.amount)).toEqual(["", ""]);
});
