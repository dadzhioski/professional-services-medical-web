import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProfilePresentation } from "./presentation";
import { Field, Button, TextAreaField } from "@/components/ui/presentation";
import { localeCodes, translator } from "@/lib/i18n";

test("profile sections render supplied content safely in every language", () => {
  for (const locale of localeCodes) {
    const html = renderToStaticMarkup(<ProfilePresentation locale={locale} name="Synthetic professional"
      introduction={'<script>alert("synthetic")</script>'} specialties={["Synthetic specialty"]}
      qualifications={{ education: "Synthetic university\n<b>Medicine</b>", specialties: "Synthetic cardiology", certificates: "  " }}
      services={[{ name: "Synthetic service" }]} locations={["Synthetic location"]} />);
    expect(html).toContain(translator(locale)("profile.education"));
    expect(html).toContain("Synthetic university\n&lt;b&gt;Medicine&lt;/b&gt;");
    expect(html).toContain("Synthetic specialty");
    expect(html).toContain("Synthetic cardiology");
    // Blank text is not shown as an empty section.
    expect(html).not.toContain(translator(locale)("profile.certificates"));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  }
});
test("the price list is a table with an on-request fallback and the indicative-price note", () => {
  render(<ProfilePresentation locale="en" name="Synthetic professional" services={[
    { name: "Synthetic exam", price: "MKD 1,500.00", description: "Line one\nline two" }, { name: "<b>Synthetic</b> unpriced" }]} />);
  const t = translator("en");
  const table = screen.getByRole("table");
  expect(screen.getByRole("heading", { level: 2, name: t("profile.services") })).toBeVisible();
  expect(screen.getByRole("columnheader", { name: t("profile.pricePrice") })).toBeVisible();
  expect(screen.getByRole("rowheader", { name: /Synthetic exam/ })).toHaveTextContent("Line one");
  expect(table).toHaveTextContent("MKD 1,500.00");
  expect(screen.getByRole("row", { name: /unpriced/ })).toHaveTextContent(t("profile.priceOnRequest"));
  expect(table.innerHTML).not.toContain("<b>");
  expect(screen.getByText(t("profile.priceNote"))).toBeVisible();
});
test("empty sections and missing photos disappear cleanly", () => {
  render(<ProfilePresentation locale="en" name="Synthetic professional" introduction=" " specialties={["", " "]} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Synthetic professional");
  expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  expect(screen.queryByRole("img")).toBeNull();
});
test("fields associate labels, hints and errors and buttons default to non-submitting", () => {
  render(<><Field id="name" label="Professional name" hint="Public display name" error="Enter a name" required aria-describedby="additional" />
    <p id="additional">Additional guidance</p><Button>Save</Button></>);
  expect(screen.getByLabelText("Professional name")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Professional name")).toHaveAccessibleDescription("Additional guidance Public display name Enter a name");
  expect(screen.getByRole("button")).toHaveAttribute("type", "button");
});
test("nested previews keep the page heading outline", () => {
  render(<ProfilePresentation locale="en" nested name="Synthetic professional" introduction="Synthetic introduction" />);
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Synthetic professional");
  expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent(translator("en")("profile.introduction"));
});
test("text areas associate labels, hints and errors", () => {
  render(<TextAreaField id="bio" label="Biography" hint="Professional background" error="Too long" />);
  expect(screen.getByLabelText("Biography").tagName).toBe("TEXTAREA");
  expect(screen.getByLabelText("Biography")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Biography")).toHaveAccessibleDescription("Professional background Too long");
});
