import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkContainerReport } from "./check-container-report.mjs";
const clean = () => ({ Results: [
  { Class: "os-pkgs", Packages: [{ Name: "musl" }] },
  { Type: "node-pkg", Packages: [{ Name: "next" }] },
] });
const passed = { highOrCritical: 0, secrets: 0, accepted: [] };
test("accepts clean inventories", () => assert.deepEqual(checkContainerReport(clean()), passed));
test("fails closed on missing scan coverage", () => assert.throws(() => checkContainerReport({ Results: [] })));
test("Caddy gate requires Go inventory in addition to OS inventory", () => {
  assert.throws(() => checkContainerReport(clean(), "gobinary"));
  const report = clean(); report.Results[1].Type = "gobinary";
  assert.deepEqual(checkContainerReport(report, "gobinary"), passed);
  report.Results[1].Vulnerabilities = [{ Severity: "CRITICAL" }];
  assert.throws(() => checkContainerReport(report, "gobinary"));
});
test("blocks unfixed high vulnerabilities", () => {
  const report = clean(); report.Results[0].Vulnerabilities = [{ Severity: "HIGH" }];
  assert.throws(() => checkContainerReport(report));
});
test("blocks secrets at any severity", () => {
  const report = clean(); report.Results[1].Secrets = [{ Severity: "MEDIUM" }];
  assert.throws(() => checkContainerReport(report));
});

const exception = JSON.parse(readFileSync(new URL("./edge-container-exception.json", import.meta.url)));
const before = new Date("2026-10-30T00:00:00Z");
const finding = () => ({ VulnerabilityID: "CVE-2026-116587", Severity: "HIGH",
  PkgName: "github.com/go-jose/go-jose/v3", InstalledVersion: "v3.0.5" });
const edge = (...vulnerabilities) => ({ Results: [
  { Class: "os-pkgs", Packages: [{ Name: "musl" }] },
  { Target: "usr/bin/caddy", Type: "gobinary", Packages: [{ Name: "caddy" }], Vulnerabilities: vulnerabilities },
] });
test("the edge exception accepts only the approved unfixed go-jose v3 finding, visibly", () => {
  assert.deepEqual(checkContainerReport(edge(finding()), "gobinary", exception, before), {
    highOrCritical: 0, secrets: 0, accepted: ["CVE-2026-116587 github.com/go-jose/go-jose/v3@v3.0.5"],
    exceptionExpiresAt: exception.expiresAt });
});
test("the edge exception expires", () => {
  assert.throws(() => checkContainerReport(edge(finding()), "gobinary", exception, new Date(exception.expiresAt)));
});
test("the exception never applies to the web image scan", () => {
  const report = clean(); report.Results[1].Target = "usr/bin/caddy"; report.Results[1].Vulnerabilities = [finding()];
  assert.throws(() => checkContainerReport(report, "node-pkg", exception, before));
});
for (const [name, change] of [
  ["a different CVE", v => { v.VulnerabilityID = "CVE-2026-000001"; }],
  ["critical severity", v => { v.Severity = "CRITICAL"; }],
  ["an available fix", v => { v.FixedVersion = "3.0.6"; }],
  ["another module", v => { v.PkgName = "github.com/go-jose/go-jose/v4"; v.InstalledVersion = "v4.1.5"; }],
  ["another version", v => { v.InstalledVersion = "v3.0.4"; }],
]) {
  test(`the edge exception rejects ${name}`, () => {
    const v = finding(); change(v);
    assert.throws(() => checkContainerReport(edge(v), "gobinary", exception, before));
  });
}
test("the edge exception rejects another binary and never hides other findings", () => {
  const report = edge(finding()); report.Results[1].Target = "usr/bin/other";
  assert.throws(() => checkContainerReport(report, "gobinary", exception, before));
  assert.throws(() => checkContainerReport(edge(finding(), { ...finding(), PkgName: "golang.org/x/net" }), "gobinary", exception, before));
});
