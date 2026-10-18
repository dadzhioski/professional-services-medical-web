import assert from "node:assert/strict";

export const releaseRepository = "dadzhioski/professional-services-medical-web";
export const releaseImages = Object.freeze({
  web: "ghcr.io/dadzhioski/professional-services-medical-web",
  caddy: "ghcr.io/dadzhioski/professional-services-medical-edge",
});
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const identifier = /^[a-z0-9][a-z0-9-]{0,63}$/;
const recordId = /^[a-f0-9]{32}$/;
const exactKeys = (value, keys) => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

export function validateReleaseRequest(request) {
  const common = ["operation", "environment", "workflowRun"];
  assert.ok(["deploy", "rollback"].includes(request?.operation));
  exactKeys(request, [...common, ...(request.operation === "deploy"
    ? ["sha", "config", "apiImage", "apiVersion"] : ["record"])]);
  assert.ok(["production", "non-production"].includes(request.environment));
  assert.match(request.workflowRun, /^[1-9][0-9]{0,19}$/);
  if (request.operation === "deploy") {
    assert.match(request.sha, sha);
    assert.match(request.config, identifier);
    validateImage(request.apiImage);
    assert.match(request.apiVersion, /^[a-zA-Z0-9][a-zA-Z0-9.+-]{0,127}$/);
  } else assert.match(request.record, recordId);
  return request;
}

export function validateReleaseManifest(manifest, expectedSha) {
  exactKeys(manifest, ["schema", "repository", "sha", "runId", "attempt", "clientVersion", "web", "caddy", "configuration"]);
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.repository, releaseRepository);
  assert.match(manifest.sha, sha);
  assert.equal(manifest.sha, expectedSha);
  assert.match(manifest.runId, /^[1-9][0-9]{0,19}$/);
  assert.ok(Number.isSafeInteger(manifest.attempt) && manifest.attempt > 0);
  assert.match(manifest.clientVersion, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/);
  for (const service of ["web", "caddy"]) {
    exactKeys(manifest[service], ["image", "digest", "revision", ...(service === "web" ? ["clientVersion"] : [])]);
    assert.equal(manifest[service].image, `${releaseImages[service]}:${manifest.sha}`);
    assert.match(manifest[service].digest, digest);
    assert.equal(manifest[service].revision, manifest.sha);
  }
  assert.equal(manifest.web.clientVersion, manifest.clientVersion);
  exactKeys(manifest.configuration, ["compose", "caddy"]);
  for (const hash of Object.values(manifest.configuration)) assert.match(hash, /^[a-f0-9]{64}$/);
  return manifest;
}

export function validateReleaseEvidence(manifest, run, artifact, now = Date.now()) {
  validateReleaseManifest(manifest, run.head_sha);
  assert.equal(run.repository?.full_name, releaseRepository);
  assert.equal(run.head_repository?.full_name, releaseRepository);
  assert.equal(run.path, ".github/workflows/ci.yml");
  assert.equal(run.event, "push");
  assert.equal(run.head_branch, "main");
  assert.equal(run.status, "completed");
  assert.equal(run.conclusion, "success");
  assert.equal(String(run.id), manifest.runId);
  assert.equal(run.run_attempt, manifest.attempt);
  assert.equal(artifact.name, `release-${manifest.sha}-${manifest.attempt}`);
  assert.equal(artifact.expired, false);
  assert.ok(Date.parse(artifact.expires_at) > now);
  assert.equal(String(artifact.workflow_run?.id), manifest.runId);
  assert.equal(artifact.workflow_run?.head_sha, manifest.sha);
  assert.match(artifact.digest, digest);
  return manifest;
}

export function validatePulledReleaseImage(manifest, service, image) {
  validateReleaseManifest(manifest, manifest.sha);
  assert.ok(Object.hasOwn(releaseImages, service));
  assert.ok(image.RepoDigests.includes(`${releaseImages[service]}@${manifest[service].digest}`));
  assert.equal(image.Config.Labels["org.opencontainers.image.revision"], manifest.sha);
  if (service === "web") {
    assert.equal(image.Config.Labels["io.professional-services.api-client.version"], manifest.clientVersion);
    assert.equal(image.Config.User, "10001:10001");
  }
  assert.match(image.Id, /^sha256:[a-f0-9]{64}$/);
  return image.Id;
}

export function validateReleaseRecord(record) {
  exactKeys(record, ["id", "status", "environment", "config", "manifest", "apiImage", "apiVersion", "workflowRun", "operation", "restoredFrom", "createdAt"]);
  assert.match(record.id, recordId);
  assert.equal(record.status, "success");
  assert.ok(Number.isFinite(Date.parse(record.createdAt)));
  assert.ok(["deploy", "rollback"].includes(record.operation));
  if (record.operation === "rollback") assert.match(record.restoredFrom, recordId);
  else assert.equal(record.restoredFrom, null);
  validateReleaseManifest(record.manifest, record.manifest.sha);
  validateReleaseRequest({ operation: "deploy", environment: record.environment, workflowRun: record.workflowRun,
    sha: record.manifest.sha, config: record.config, apiImage: record.apiImage, apiVersion: record.apiVersion });
  return record;
}

export function validateDeploymentState(state) {
  exactKeys(state, ["current", "previous", "pending"]);
  for (const key of ["current", "previous", "pending"]) if (state[key] !== null) assert.match(state[key], recordId);
  assert.ok(state.current !== null || state.previous === null);
  return state;
}

export function validateImage(image) {
  // Optional registry port, repository components, then exactly the published SHA.
  if (typeof image !== "string" || image !== image.trim() || !/^(?:[a-z0-9.-]+:[0-9]+\/)?[a-z0-9]+(?:[._/-][a-z0-9]+)*:[a-f0-9]{40}$/.test(image)) {
    throw new Error("Image must use a repository and bare full 40-character lowercase commit-SHA tag");
  }
  return image;
}

export function validateSite(site) {
  if (typeof site !== "string" || site !== site.trim() || !/^(?:https:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(site)) {
    throw new Error("SITE_ADDRESS must be one HTTPS DNS hostname without a path, port, or credentials");
  }
  return site;
}

export function validateTopology(config, smoke = false) {
  assert.deepEqual(Object.keys(config.services).sort(), ["caddy", "web"]);
  const { caddy, web } = config.services;
  validateImage(web.image);
  validateImage(caddy.image);
  assert.equal(web.ports?.length ?? 0, 0);
  assert.deepEqual(Object.keys(web.networks), ["edge"]);
  assert.deepEqual(Object.keys(caddy.networks), ["edge"]);
  assert.ok(web.networks.edge.aliases.includes("web"));
  assert.equal(web.environment.API_INTERNAL_URL, "http://api:8080");
  // Older immutable releases predate this setting and remain rollback targets.
  if (web.environment.PUBLIC_ORIGIN !== undefined) {
    const origin = web.environment.PUBLIC_ORIGIN;
    if (smoke) assert.match(origin, /^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/);
    else {
      const site = validateSite(caddy.environment.SITE_ADDRESS).replace(/^https:\/\//, "");
      assert.equal(origin, `https://${site}`);
    }
  }
  assert.equal(config.networks.edge.external, true);
  assert.deepEqual(Object.keys(config.networks), ["edge"]);
  const bindings = caddy.ports.map(p => `${p.host_ip ?? "*"}:${p.published}:${p.target}/${p.protocol}`).sort();
  assert.deepEqual(bindings, smoke ? ["127.0.0.1:0:80/tcp"] : ["*:443:443/tcp", "*:443:443/udp", "*:80:80/tcp"]);
  for (const target of ["/data", "/config"]) assert.ok(caddy.volumes.some(v => v.type === "volume" && v.target === target));
  assert.ok(caddy.volumes.some(v => v.target === "/etc/caddy/Caddyfile" && v.read_only));
  assert.ok(caddy.healthcheck);
  for (const service of [web, caddy]) {
    assert.equal(service.restart, "unless-stopped");
    assert.equal(service.logging.options["max-size"], "10m");
    assert.equal(service.logging.options["max-file"], "5");
    assert.ok(service.mem_limit > 0);
  }
}
