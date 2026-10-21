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
      credentials={["Synthetic qualification"]} services={["Synthetic service"]} locations={["Synthetic location"]} />);
    expect(html).toContain(translator(locale)("profile.credentials"));
    expect(html).toContain("Synthetic qualification");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  }
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
