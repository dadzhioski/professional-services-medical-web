import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ImageInput } from "./image-input";

const view = () => render(<ImageInput id="photo" name="photo" label="Choose an image" hint="JPEG or PNG"
  tooLarge="Too large" unsupported="Unsupported" />);
const choose = (input: HTMLElement, file: File) => fireEvent.change(input, { target: { files: [file] } });

test("a labelled, required JPEG/PNG file input with its hint", () => {
  view();
  const input = screen.getByLabelText("Choose an image");
  expect(input).toHaveAttribute("type", "file");
  expect(input).toHaveAttribute("accept", "image/jpeg,image/png");
  expect(input).toBeRequired();
  expect(input).toHaveAccessibleDescription("JPEG or PNG");
  expect(screen.queryByRole("alert")).toBeNull();
});

test.each([
  [new File(["%PDF"], "doc.pdf", { type: "application/pdf" }), "Unsupported"],
  [new File(["x"], "photo.gif", { type: "image/gif" }), "Unsupported"],
  [new File([new Uint8Array(10_485_761)], "big.jpg", { type: "image/jpeg" }), "Too large"],
])("unsuitable file %# blocks submission with an announced reason", (file, message) => {
  view();
  const input = screen.getByLabelText<HTMLInputElement>("Choose an image");
  choose(input, file);
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input.validationMessage).toBe(message);
  expect(input).toHaveAccessibleDescription(`JPEG or PNG ${message}`);
});

test("choosing a suitable file clears an earlier problem", () => {
  view();
  const input = screen.getByLabelText<HTMLInputElement>("Choose an image");
  choose(input, new File(["%PDF"], "doc.pdf", { type: "application/pdf" }));
  choose(input, new File([new Uint8Array(8)], "photo.png", { type: "image/png" }));
  expect(screen.queryByRole("alert")).toBeNull();
  // jsdom keeps its own "required" state for simulated files; only the custom hint must be gone.
  expect(input.validity.customError).toBe(false);
  expect(input).not.toHaveAttribute("aria-invalid");
});

test("a file the browser cannot type is left for the API to check", () => {
  view();
  const input = screen.getByLabelText<HTMLInputElement>("Choose an image");
  choose(input, new File([new Uint8Array(8)], "scan", { type: "" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(input.validity.customError).toBe(false);
});
