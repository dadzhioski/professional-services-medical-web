// The optional exception applies only to the Caddy (gobinary) scan and only while unexpired.
export function checkContainerReport(report, applicationType = "node-pkg", exception = null, now = new Date()) {
  const results = report.Results;
  if (!Array.isArray(results) || !results.some(r => r.Class === "os-pkgs" && r.Packages?.length) ||
      !results.some(r => r.Type === applicationType && r.Packages?.length)) {
    throw new Error(`Container scan must include OS and ${applicationType} package inventories`);
  }
  const expiry = Date.parse(exception?.expiresAt);
  const active = applicationType === "gobinary" && Number.isFinite(expiry) && now.getTime() < expiry;
  // Exactly the approved finding: same CVE, binary, module and version, HIGH (never CRITICAL), still unfixed.
  const approved = (result, v) => active && result.Type === "gobinary" && result.Target === exception.target &&
    v.VulnerabilityID === exception.vulnerability && v.Severity === "HIGH" && !v.FixedVersion &&
    v.PkgName === exception.package.name && v.InstalledVersion === exception.package.version;
  const accepted = [];
  const vulnerabilities = [];
  for (const result of results) {
    for (const v of result.Vulnerabilities ?? []) {
      if (!["HIGH", "CRITICAL"].includes(v.Severity)) continue;
      (approved(result, v) ? accepted : vulnerabilities).push(`${v.VulnerabilityID} ${v.PkgName}@${v.InstalledVersion}`);
    }
  }
  const secrets = results.flatMap(r => r.Secrets ?? []);
  const summary = { highOrCritical: vulnerabilities.length, secrets: secrets.length, accepted };
  if (accepted.length) summary.exceptionExpiresAt = exception.expiresAt;
  if (vulnerabilities.length || secrets.length) {
    throw new Error(`Container security gate failed: ${JSON.stringify(summary)}`);
  }
  return summary;
}
