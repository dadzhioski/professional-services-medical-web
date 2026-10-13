import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkDependencyAudit } from "./check-dependency-audit.mjs";

// npm supplies its CLI path on Windows and Linux; avoid shell interpolation.
if (!process.env.npm_execpath) throw new Error("Run npm run security:dependencies");
const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json", "--audit-level=high"], {
  encoding: "utf8", timeout: 120_000, maxBuffer: 10 * 1024 * 1024,
});
if (result.error || result.signal || ![0, 1].includes(result.status)) {
  throw new Error("npm audit could not complete; dependency gate fails closed");
}
let report;
try { report = JSON.parse(result.stdout); } catch { throw new Error("npm audit returned invalid JSON"); }
const exception = JSON.parse(readFileSync(new URL("./dependency-audit-exception.json", import.meta.url)));
const lock = JSON.parse(readFileSync("package-lock.json"));
const summary = checkDependencyAudit(report, lock, exception);
if (result.status === 1 && summary.accepted.length + summary.blocked.length === 0) {
  throw new Error("npm audit failed without high/critical findings; refusing to ignore the error");
}
if (summary.accepted.length) {
  console.warn(`APPROVED TEMPORARY EXCEPTION: ${exception.advisory}`);
  console.warn(`Development-only packages: ${summary.accepted.join(", ")}`);
  console.warn(`Expires ${summary.expiresAt}; these vulnerabilities remain present.`);
}
if (summary.blocked.length) {
  console.error(`Dependency security gate BLOCKED: ${summary.blocked.join(", ")}`);
  console.error("Only the approved versions/paths are eligible, before the exception expires.");
  process.exitCode = 1;
} else {
  console.log(`Dependency security gate passed (${summary.total} findings; ${summary.accepted.length} temporarily accepted).`);
}
