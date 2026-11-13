import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { translator } from "@/lib/i18n";
import { editorMessageKeys, type EditorMessages, type EditorState } from "./fields";
import { ProfileEditor } from "./profile-editor";

const t = translator("en");
const messages = Object.fromEntries(editorMessageKeys.map(key => [key, t(key)])) as EditorMessages;
const idle: EditorState = { status: "idle", values: { displayName: "Saved name", biography: "Saved biography" }, version: 2, errors: {} };
const editor = (action: (previous: EditorState, form: FormData) => Promise<EditorState>, initial = idle) =>
  render(<ProfileEditor action={action} initial={initial} messages={messages} loginHref="/api/auth/login?returnTo=%2Fen%2Fprovider" reloadHref="/en/provider/profile" />);

test("labelled fields carry the saved draft, contract limits and the version", () => {
  const { container } = editor(vi.fn());
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveValue("Saved name");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveAttribute("maxlength", "255");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveAccessibleDescription(t("profileEditor.displayNameHint"));
  expect(screen.getByLabelText(t("profileEditor.biography"))).toHaveAttribute("maxlength", "2000");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).not.toBeRequired();
  expect(container.querySelector('input[type="hidden"][name="version"]')).toHaveValue("2");
  expect(screen.queryByRole("region", { name: t("profileEditor.problem") })).toBeNull();
  expect(screen.queryByRole("button", { name: t("profileEditor.overwrite") })).toBeNull();
});

test("a failed save keeps input and moves focus to a linked error summary", async () => {
  const action = vi.fn(async (_previous: EditorState, form: FormData): Promise<EditorState> => ({
    status: "invalid", values: { displayName: String(form.get("displayName")), biography: "" }, version: 2, errors: { displayName: "tooLong" } }));
  editor(action);
  fireEvent.change(screen.getByLabelText(t("profileEditor.displayName")), { target: { value: "Typed name" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("profileEditor.save") })); });
  await waitFor(() => expect(screen.getByRole("region", { name: t("profileEditor.problem") })).toHaveFocus());
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("region", { name: t("profileEditor.problem") })).toHaveTextContent(t("profileEditor.invalid"));
  expect(screen.getByRole("link", { name: `${t("profileEditor.displayName")}: ${t("profileEditor.tooLong")}` }))
    .toHaveAttribute("href", "#profile-displayName");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveValue("Typed name");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveAttribute("aria-invalid", "true");
});

test("lost authorization keeps input and offers sign-in", () => {
  editor(vi.fn(), { ...idle, status: "expired", values: { displayName: "Typed name", biography: "" } });
  expect(screen.getByRole("region", { name: t("profileEditor.problem") })).toHaveTextContent(`${t("account.expired")} ${t("profileEditor.keptInput")}`);
  expect(screen.getByRole("link", { name: t("account.login") })).toHaveAttribute("href", "/api/auth/login?returnTo=%2Fen%2Fprovider");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveValue("Typed name");
});

test("a stale edit shows the latest version and only explicit choices", () => {
  const { container } = editor(vi.fn(), { ...idle, status: "conflict", values: { displayName: "Typed name", biography: "Typed" },
    latest: { displayName: "Other tab", biography: "", version: 5 } });
  expect(screen.getByRole("region", { name: t("profileEditor.problem") })).toHaveTextContent(t("profileEditor.conflict"));
  const latest = screen.getByRole("region", { name: t("profileEditor.latestHeading") });
  expect(latest).toHaveTextContent("Other tab");
  expect(latest).toHaveTextContent(t("profileEditor.empty"));
  expect(screen.getByRole("link", { name: t("profileEditor.discard") })).toHaveAttribute("href", "/en/provider/profile");
  expect(screen.getByLabelText(t("profileEditor.displayName"))).toHaveValue("Typed name");
  // The default save keeps the stale version; only the overwrite button carries the reviewed one.
  expect(container.querySelector('input[name="version"]')).toHaveValue("2");
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toHaveAccessibleName(t("profileEditor.save"));
  expect(screen.getByRole("button", { name: t("profileEditor.overwrite") })).toHaveAttribute("value", "5");
});

test("a saved draft is announced as status, not as an error", () => {
  editor(vi.fn(), { ...idle, status: "saved" });
  expect(screen.getByRole("status")).toHaveTextContent(t("profileEditor.saved"));
  expect(screen.queryByRole("region", { name: t("profileEditor.problem") })).toBeNull();
});
test("a saved draft links back to the checklist; failures do not", () => {
  const savedLink = { href: "/en/provider/onboarding", label: t("onboarding.backToChecklist") };
  const { unmount } = render(<ProfileEditor action={vi.fn()} initial={{ ...idle, status: "saved" }} messages={messages} loginHref="/login" reloadHref="/en/provider/profile" savedLink={savedLink} />);
  expect(screen.getByRole("link", { name: t("onboarding.backToChecklist") })).toHaveAttribute("href", "/en/provider/onboarding");
  unmount();
  render(<ProfileEditor action={vi.fn()} initial={{ ...idle, status: "invalid" }} messages={messages} loginHref="/login" reloadHref="/en/provider/profile" savedLink={savedLink} />);
  expect(screen.queryByRole("link", { name: t("onboarding.backToChecklist") })).toBeNull();
});
