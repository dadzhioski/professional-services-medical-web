import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { checkContainerReport } from "./check-container-report.mjs";
import { validateImage } from "./production-config.mjs";
const gitleaks = "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
const trivy = "aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa";
const docker = args => execFileSync("docker", args, { stdio: "inherit" });
mkdirSync("reports/security", { recursive: true });
if (process.argv[2] === "workflows") {
  // Pinned upstream validator; no npm dependency or executable downloaded unverified.
  docker(["run", "--rm", "--network", "none", "-v", `${resolve(".")}:/repo:ro`, "-w", "/repo",
    "rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667", "-color"]);
} else if (process.argv[2] === "secrets") {
  const base = ["run", "--rm", "-v", `${resolve(".")}:/work`, "-w", "/work", "-e", "GIT_CONFIG_COUNT=1", "-e", "GIT_CONFIG_KEY_0=safe.directory", "-e", "GIT_CONFIG_VALUE_0=/work", gitleaks];
  docker([...base, "git", "--redact", "--no-banner", "--log-opts=--all", "--report-format", "json", "--report-path", "reports/security/history.json", "."]);
  // Scan tracked and untracked source, excluding only generated/ignored files.
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const temp = mkdtempSync(join(tmpdir(), "web-secret-scan-"));
  try {
    const { copyFileSync, existsSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    for (const file of files) {
      if (!existsSync(file)) continue;
      mkdirSync(dirname(join(temp, file)), { recursive: true }); copyFileSync(file, join(temp, file));
    }
    docker(["run", "--rm", "-v", `${temp}:/scan:ro`, gitleaks, "dir", "--redact", "--no-banner", "/scan"]);
    // Controlled negative probe outside the repository; never save a real credential.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const synthetic = Array.from(randomBytes(36), b => alphabet[b % alphabet.length]).join("");
    writeFileSync(join(temp, "probe.txt"), `github_token = "${"ghp_"}${synthetic}"`);
    const probe = spawnSync("docker", ["run", "--rm", "-v", `${temp}:/scan:ro`, gitleaks, "dir", "--redact", "--no-banner", "/scan"], { stdio: "pipe" });
    if (probe.status !== 1) throw new Error("Secret scanner failed controlled detection probe");
    console.log("Controlled secret detected; disposable probe removed.");
  } finally { rmSync(temp, { recursive: true, force: true }); }
} else if (["container", "edge-container"].includes(process.argv[2])) {
  const edge = process.argv[2] === "edge-container";
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const image = edge ? process.env.CADDY_IMAGE ?? `professional-services-medical-edge:${revision}`
    : process.env.IMAGE ?? `professional-services-medical-web:${revision}`;
  validateImage(image);
  const name = edge ? "edge-container" : "container";
  docker(["save", image, "--output", `reports/${name}.tar`]);
  docker(["run", "--rm", "-v", `${resolve("reports")}:/reports`, trivy, "image", "--quiet", "--input", `/reports/${name}.tar`, "--scanners", "vuln,secret", "--format", "json", "--output", `/reports/security/${name}.json`]);
  // Only the edge scan reads the owner-approved exception; the web image scan has none.
  const exception = edge ? JSON.parse(readFileSync("scripts/edge-container-exception.json")) : null;
  console.log(checkContainerReport(JSON.parse(readFileSync(`reports/security/${name}.json`)), edge ? "gobinary" : "node-pkg", exception));
} else { throw new Error("Expected secrets, container, or edge-container"); }
