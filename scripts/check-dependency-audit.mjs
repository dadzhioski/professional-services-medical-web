const severities = new Set(["info", "low", "moderate", "high", "critical"]);

export function checkDependencyAudit(report, lock, exception, now = new Date()) {
  if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities ||
      typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities)) {
    throw new Error("Invalid or failed npm audit report");
  }
  const findings = Object.entries(report.vulnerabilities);
  const counts = report.metadata?.vulnerabilities;
  if (!counts || counts.total !== findings.length || !Number.isFinite(now.getTime())) {
    throw new Error("Missing or inconsistent npm audit metadata");
  }
  for (const severity of severities) {
    if (counts[severity] !== findings.filter(([, v]) => v?.severity === severity).length) {
      throw new Error("Inconsistent npm audit severity counts");
    }
  }
  for (const [name, finding] of findings) {
    if (finding?.name !== name || !severities.has(finding.severity) ||
        !Array.isArray(finding.via) || !finding.via.length ||
        !Array.isArray(finding.nodes) || !finding.nodes.length) {
      throw new Error("Malformed npm audit finding");
    }
  }

  const expiry = Date.parse(exception.expiresAt);
  const active = Number.isFinite(expiry) && now.getTime() < expiry;
  function approved(name, visiting = new Set()) {
    const policy = exception.packages[name];
    const finding = report.vulnerabilities[name];
    if (!active || !policy || !finding || finding.severity !== "high" || visiting.has(name)) return false;
    const path = `node_modules/${name}`;
    if (finding.nodes.length !== 1 || finding.nodes[0] !== path) return false;
    // Check every installed occurrence, not just npm's reported vulnerable node.
    const occurrences = Object.entries(lock.packages ?? {}).filter(([p]) => p === path || p.endsWith(`/${path}`));
    if (occurrences.length !== 1 || occurrences[0][0] !== path ||
        occurrences[0][1].dev !== true || occurrences[0][1].version !== policy.version) return false;
    if (finding.via.length !== 1) return false;
    const via = finding.via[0];
    if (policy.via === null) {
      return name === "braces" && typeof via === "object" && via !== null &&
        via.url === exception.advisory && via.dependency === "braces" && via.severity === "high";
    }
    if (via !== policy.via) return false;
    return approved(via, new Set([...visiting, name]));
  }

  const accepted = [];
  const blocked = [];
  for (const [name, finding] of findings) {
    if (!["high", "critical"].includes(finding.severity)) continue;
    (approved(name) ? accepted : blocked).push(name);
  }
  return { accepted, blocked, expiresAt: exception.expiresAt, total: findings.length };
}
