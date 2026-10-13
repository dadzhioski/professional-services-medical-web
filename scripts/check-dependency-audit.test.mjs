import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkDependencyAudit } from "./check-dependency-audit.mjs";
const exception = JSON.parse(readFileSync(new URL("./dependency-audit-exception.json", import.meta.url)));
const now = new Date("2026-10-12T12:00:00Z");
function fixture() {
  const lock = { packages: {} };
  const report = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: {} } };
  for (const [name, policy] of Object.entries(exception.packages)) {
    lock.packages[`node_modules/${name}`] = { version: policy.version, dev: true };
    report.vulnerabilities[name] = { name, severity: "high", nodes: [`node_modules/${name}`],
      via: [policy.via ?? { url: exception.advisory, dependency: "braces", severity: "high" }] };
  }
  return { report, lock };
}
function evaluate(report, lock, time = now, policy = exception) {
  const values = Object.values(report.vulnerabilities);
  report.metadata.vulnerabilities = Object.fromEntries(["info", "low", "moderate", "high", "critical"].map(s => [s, values.filter(v => v.severity === s).length]));
  report.metadata.vulnerabilities.total = values.length;
  return checkDependencyAudit(report, lock, policy, time);
}
test("accepts exactly the five approved development findings", () => {
  const { report, lock } = fixture();
  assert.equal(evaluate(report, lock).accepted.length, 5);
  assert.deepEqual(evaluate(report, lock).blocked, []);
});
test("expires at the exact deadline", () => {
  const { report, lock } = fixture();
  assert.equal(evaluate(report, lock, new Date("2026-10-25T23:59:59Z")).accepted.length, 5);
  assert.equal(evaluate(report, lock, new Date(exception.expiresAt)).blocked.length, 5);
});
for (const change of ["production", "version", "nested", "advisory", "additional-advisory", "critical", "cycle"]) {
  test(`rejects ${change} changes in the exception chain`, () => {
    const { report, lock } = fixture();
    const leaf = report.vulnerabilities.braces;
    if (change === "production") lock.packages["node_modules/braces"].dev = false;
    if (change === "version") lock.packages["node_modules/braces"].version = "3.0.2";
    if (change === "nested") lock.packages["node_modules/other/node_modules/braces"] = { version: "3.0.3", dev: true };
    if (change === "advisory") leaf.via[0].url = "https://github.com/advisories/OTHER";
    if (change === "additional-advisory") leaf.via.push({ url: "OTHER", severity: "high" });
    if (change === "critical") leaf.severity = "critical";
    if (change === "cycle") leaf.via = ["eslint-config-next"];
    assert.equal(evaluate(report, lock).blocked.length, 5);
  });
}
test("blocks an unrelated vulnerability while retaining the approved exception", () => {
  const { report, lock } = fixture();
  report.vulnerabilities.other = { name: "other", severity: "high", via: [{ url: "OTHER" }], nodes: ["node_modules/other"] };
  assert.deepEqual(evaluate(report, lock).blocked, ["other"]);
});
test("invalid expiration fails closed", () => {
  const { report, lock } = fixture();
  assert.equal(evaluate(report, lock, now, { ...exception, expiresAt: "invalid" }).blocked.length, 5);
});
test("clean reports pass even after expiry", () => {
  const { report, lock } = fixture(); report.vulnerabilities = {};
  assert.deepEqual(evaluate(report, lock, new Date("2026-11-01")).blocked, []);
});
test("registry errors and missing reports fail closed", () => {
  assert.throws(() => checkDependencyAudit({ error: { code: "E403" } }, {}, exception, now));
  assert.throws(() => checkDependencyAudit({}, {}, exception, now));
});
test("inconsistent totals cannot hide findings", () => {
  const { report, lock } = fixture(); evaluate(report, lock);
  report.metadata.vulnerabilities.total = 0;
  assert.throws(() => checkDependencyAudit(report, lock, exception, now));
});
