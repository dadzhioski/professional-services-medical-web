import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adminMediaContentPath, isUuid, mediaContentPath } from "./media";

const id = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";

test("only well-formed IDs become same-origin owner content paths", () => {
  expect(mediaContentPath(id)).toBe(`/api/v1/media/${id}/content`);
  expect(mediaContentPath(id.toUpperCase())).toBe(`/api/v1/media/${id.toUpperCase()}/content`);
  expect(adminMediaContentPath(id)).toBe(`/api/v1/admin/media/${id}/content`);
});
test.each([undefined, null, "", 42, {}, "../../profile", `${id}/../../x`, `${id}?x=1`, `${id}#x`, "javascript:alert(1)",
  "https://evil.test/image.png", "//evil.test/image.png", `${id} `, `/${id}`, "0b3f9c2e6a1d4c589e7f2d4a8b1c5e60"])(
  "rejects unsafe or malformed ID %j", value => {
    expect(mediaContentPath(value)).toBeNull();
    expect(adminMediaContentPath(value)).toBeNull();
    expect(isUuid(value)).toBe(false);
  });
