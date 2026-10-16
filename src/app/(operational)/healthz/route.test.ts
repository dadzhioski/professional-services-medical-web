// @vitest-environment node
import { expect, test } from "vitest";
import { GET } from "./route";

test("health response contains only a fixed status and is not cached", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
