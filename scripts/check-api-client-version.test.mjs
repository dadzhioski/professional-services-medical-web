import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkClient } from "./check-api-client-version.mjs";
const manifest = JSON.parse(readFileSync("package.json"));
const lock = JSON.parse(readFileSync("package-lock.json"));
const name = "@dadzhioski/professional-services-api-client";
test("accepts the installed registry release", () => assert.equal(checkClient(manifest, lock), "0.2.0"));
for (const version of ["^0.2.0", "~0.2.0", "*", "latest", "github:owner/repo", "file:client", "0.2", "01.2.0", "0.2.0-01"]) {
  test(`rejects ${version}`, () => assert.throws(() => checkClient({ ...manifest, dependencies: { [name]: version } }, lock)));
}
test("rejects a lock mismatch", () => {
  const changed = structuredClone(lock);
  changed.packages[`node_modules/${name}`].version = "0.1.0";
  assert.throws(() => checkClient(manifest, changed));
});
test("rejects missing integrity", () => {
  const changed = structuredClone(lock);
  delete changed.packages[`node_modules/${name}`].integrity;
  assert.throws(() => checkClient(manifest, changed));
});
