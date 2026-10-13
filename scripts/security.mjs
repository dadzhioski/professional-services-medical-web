import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { checkContainerReport } from "./check-container-report.mjs";
const gitleaks = "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
const trivy = "aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa";
const docker = args => execFileSync("docker", args, { stdio: "inherit" });
mkdirSync("reports/security", { recursive: true });
if (process.argv[2] === "secrets") {
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
} else if (process.argv[2] === "container") {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const image = process.env.IMAGE ?? `professional-services-medical-web:${revision}`;
  if (!/^[a-z0-9./_-]+:[a-f0-9]{40}$/.test(image)) throw new Error("Expected full SHA image tag");
  docker(["save", image, "--output", "reports/image.tar"]);
  docker(["run", "--rm", "-v", `${resolve("reports")}:/reports`, trivy, "image", "--quiet", "--input", "/reports/image.tar", "--scanners", "vuln,secret", "--format", "json", "--output", "/reports/security/container.json"]);
  console.log(checkContainerReport(JSON.parse(readFileSync("reports/security/container.json"))));
} else { throw new Error("Expected secrets or container"); }
