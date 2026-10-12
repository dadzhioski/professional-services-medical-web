import { test } from "node:test";
import assert from "node:assert/strict";
import { checkContainerReport } from "./check-container-report.mjs";
const clean = () => ({ Results: [
  { Class: "os-pkgs", Packages: [{ Name: "musl" }] },
  { Type: "node-pkg", Packages: [{ Name: "next" }] },
] });
test("accepts clean inventories", () => assert.deepEqual(checkContainerReport(clean()), { highOrCritical: 0, secrets: 0 }));
test("fails closed on missing scan coverage", () => assert.throws(() => checkContainerReport({ Results: [] })));
test("blocks unfixed high vulnerabilities", () => {
  const report = clean(); report.Results[0].Vulnerabilities = [{ Severity: "HIGH" }];
  assert.throws(() => checkContainerReport(report));
});
test("blocks secrets at any severity", () => {
  const report = clean(); report.Results[1].Secrets = [{ Severity: "MEDIUM" }];
  assert.throws(() => checkContainerReport(report));
});
