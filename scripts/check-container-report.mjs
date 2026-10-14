export function checkContainerReport(report, applicationType = "node-pkg") {
  const results = report.Results;
  if (!Array.isArray(results) || !results.some(r => r.Class === "os-pkgs" && r.Packages?.length) ||
      !results.some(r => r.Type === applicationType && r.Packages?.length)) {
    throw new Error(`Container scan must include OS and ${applicationType} package inventories`);
  }
  const vulnerabilities = results.flatMap(r => r.Vulnerabilities ?? [])
    .filter(v => ["HIGH", "CRITICAL"].includes(v.Severity));
  const secrets = results.flatMap(r => r.Secrets ?? []);
  const summary = { highOrCritical: vulnerabilities.length, secrets: secrets.length };
  if (vulnerabilities.length || secrets.length) {
    throw new Error(`Container security gate failed: ${JSON.stringify(summary)}`);
  }
  return summary;
}
