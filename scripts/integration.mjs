import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, rmdirSync, lstatSync, openSync, fsyncSync, closeSync, rmSync, mkdtempSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { validateImage, validateSite, validateTopology, validateReleaseRequest, validateReleaseRecord,
  validateReleaseManifest, validateDeploymentState, validatePulledReleaseImage, releaseRepository, releaseImages } from "./production-config.mjs";
import { checkClient } from "./check-api-client-version.mjs";
import { getReleaseEvidence, githubJson, hashBytes } from "./image.mjs";
import { verifyApiIdentity, verifyReleaseHttp } from "./compatibility.mjs";

const statePath = resolve("reports/integration-state.json");
const clientVersion = checkClient(JSON.parse(readFileSync("package.json")), JSON.parse(readFileSync("package-lock.json")));
const label = "io.professional-services.web-smoke";
const sleep = ms => new Promise(r => setTimeout(r, ms));
function docker(args, env = {}) {
  try {
    return execFileSync("docker", args, { encoding: "utf8", stdio: "pipe", timeout: 300_000,
      env: { ...process.env, ...env } }).trim();
  } catch { throw new Error(`Docker ${args[0]} ${args[1] ?? ""} failed (raw output withheld; inspect synthetic resources locally)`); }
}
const inspect = (kind, name) => JSON.parse(docker([kind, "inspect", name]))[0];
function compose(state, args) {
  return docker(["compose", "--project-name", state.id, "--env-file", resolve(".env.production.example"),
    "-f", resolve("deployment/compose.yaml"), ...(state.smoke ? ["-f", resolve("deployment/compose.smoke.yaml")] : []), ...args], {
    WEB_IMAGE: state.image, CADDY_IMAGE: state.caddyImage, SITE_ADDRESS: state.site ?? "medical.example.test", EDGE_NETWORK: state.network,
    PUBLIC_ORIGIN: state.smoke ? (state.origin ?? "http://127.0.0.1") : `https://${validateSite(state.site ?? "medical.example.test").replace(/^https:\/\//, "")}`,
  });
}
function readState() {
  const state = JSON.parse(readFileSync(statePath));
  assert.match(state.id, /^web-smoke-[a-f0-9]{16}$/);
  assert.equal(state.network, `${state.id}-edge`);
  assert.equal(state.fixture, `${state.id}-fixture`);
  assert.equal(state.smoke, true);
  validateImage(state.image);
  validateImage(state.caddyImage);
  return state;
}
function ownFixture(s) {
  assert.equal(inspect("container", s.fixture).Config.Labels[label], s.id);
}
function service(s, name) {
  const id = compose(s, ["ps", "--all", "--quiet", name]);
  assert.ok(id && !id.includes("\n"));
  assert.equal(inspect("container", id).Config.Labels["com.docker.compose.project"], s.id);
  return id;
}
function control(s, mode) {
  ownFixture(s);
  return docker(["exec", s.fixture, "node", "-e", `fetch('http://127.0.0.1:8081/${mode}',{method:'POST'}).then(r=>{if(r.status!==204)process.exit(1)}).catch(()=>process.exit(1))`]);
}
function fixtureRequest(s) {
  ownFixture(s);
  return JSON.parse(docker(["exec", s.fixture, "node", "-e", "fetch('http://127.0.0.1:8081/last-request').then(r=>r.text()).then(console.log)"]));
}
function origin(s) {
  const binding = compose(s, ["port", "caddy", "80"]);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  return `http://${binding}`;
}
function synchronizeSmokeOrigin(s) {
  s.origin = origin(s);
  writeFileSync(statePath, JSON.stringify(s, null, 2));
  const expected = `PUBLIC_ORIGIN=${s.origin}`;
  if (!inspect("container", service(s, "web")).Config.Env.includes(expected)) {
    compose(s, ["up", "--detach", "--no-deps", "--force-recreate", "--wait", "--wait-timeout", "90", "web"]);
  }
  assert.ok(inspect("container", service(s, "web")).Config.Env.includes(expected));
}
async function get(s, path, options = {}) {
  const response = await fetch(`${s.origin ?? origin(s)}${path}`, { ...options, signal: AbortSignal.timeout(15_000), redirect: "manual" });
  const body = await response.text();
  assert.doesNotMatch(body, /http:\/\/api:8080|API_INTERNAL_URL|ResponseError|err_trace/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("server"), null);
  assert.equal(response.headers.get("strict-transport-security"), null);
  return { response, body };
}
async function healthy(s) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const statuses = ["web", "caddy"].map(n => inspect("container", service(s, n)).State.Health?.Status);
    if (statuses.every(v => v === "healthy")) return;
    await sleep(1000);
  }
  throw new Error("Web/Caddy did not become healthy within 60 seconds");
}
function ensureNetwork(name, owner) {
  assert.match(name, /^[a-z0-9][a-z0-9_-]{0,80}$/);
  try { inspect("network", name); } catch {
    try { docker(["network", "create", ...(owner ? ["--label", `${label}=${owner}`] : []), name]); } catch { inspect("network", name); }
  }
  const network = inspect("network", name);
  if (owner) assert.equal(network.Labels[label], owner);
  return network.Id;
}
async function validate() {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const s = { id: "web-config-validation", image: validateImage(process.env.WEB_IMAGE ?? `example/web:${"0".repeat(40)}`),
    caddyImage: validateImage(process.env.CADDY_IMAGE ?? `professional-services-medical-edge:${revision}`),
    site: validateSite(process.env.SITE_ADDRESS ?? "medical.example.test"), network: "professional-services-edge" };
  const config = JSON.parse(compose(s, ["config", "--format", "json"]));
  assert.ok(config.services.web.environment.PUBLIC_ORIGIN);
  validateTopology(config);
  validateTopology(JSON.parse(compose({ ...s, smoke: true }, ["config", "--format", "json"])), true);
  for (const site of ["http://:80", "medical.example.test"]) {
    docker(["run", "--rm", "--network", "none", "--mount", `type=bind,src=${resolve("deployment/Caddyfile")},dst=/etc/caddy/Caddyfile,readonly`,
      "-e", `SITE_ADDRESS=${site}`, config.services.caddy.image, "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]);
  }
  console.log("Production and smoke topology/Caddy validation passed");
}
async function up() {
  assert.ok(!existsSync(statePath), "Integration state already exists; finish or clean up that run first");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const image = validateImage(process.env.WEB_IMAGE ?? `professional-services-medical-web:${revision}`);
  const caddyImage = validateImage(process.env.CADDY_IMAGE ?? `professional-services-medical-edge:${revision}`);
  const caddyLabels = inspect("image", caddyImage).Config.Labels;
  assert.equal(caddyLabels["org.opencontainers.image.revision"], caddyImage.slice(caddyImage.lastIndexOf(":") + 1));
  assert.equal(caddyLabels["io.professional-services.caddy.version"], "2.11.7");
  assert.equal(caddyLabels["io.professional-services.caddy.go"], "1.26.9");
  assert.equal(caddyLabels["io.professional-services.caddy.x-net"], "0.60.0");
  const labels = inspect("image", image).Config.Labels;
  assert.equal(labels["org.opencontainers.image.revision"], image.slice(image.lastIndexOf(":") + 1));
  assert.equal(labels["io.professional-services.api-client.version"], clientVersion);
  const id = `web-smoke-${randomBytes(8).toString("hex")}`;
  const s = { id, image, caddyImage, network: `${id}-edge`, fixture: `${id}-fixture`, smoke: true };
  validateTopology(JSON.parse(compose(s, ["config", "--format", "json"])), true);
  mkdirSync("reports", { recursive: true });
  writeFileSync(statePath, JSON.stringify(s, null, 2), { flag: "wx" });
  try {
    const networkId = ensureNetwork(s.network, id);
    assert.equal(ensureNetwork(s.network, id), networkId, "Network bootstrap must be idempotent");
    docker(["run", "--detach", "--name", s.fixture, "--label", `${label}=${id}`, "--network", s.network, "--network-alias", "api",
      "--mount", `type=bind,src=${resolve("tests/integration/api-fixture.mjs")},dst=/fixture.mjs,readonly`, "--entrypoint", "node", image, "/fixture.mjs"]);
    compose(s, ["up", "--detach", "--wait", "--wait-timeout", "90", "web", "caddy"]);
    await healthy(s);
    synchronizeSmokeOrigin(s);
    console.log(`Synthetic integration ready: ${origin(s)}; web=${image}; client=${clientVersion}`);
  } catch (error) { await down(); throw error; }
}
async function routing(s) {
  control(s, "up");
  const health = await get(s, "/healthz");
  assert.equal(health.response.status, 200);
  assert.deepEqual(JSON.parse(health.body), { status: "ok" });
  assert.equal(health.response.headers.get("cache-control"), "no-store");
  const page = await get(s, "/system-status");
  assert.equal(page.response.status, 200);
  assert.match(page.body, /synthetic-api/);
  assert.match(page.body, /noindex/);
  const api = await get(s, "/api/v1/system/status?token=synthetic-query-canary", { headers: {
    Authorization: "Bearer synthetic-auth-canary", Cookie: "session=synthetic-cookie-canary", "X-Forwarded-For": "198.51.100.99", "X-Forwarded-Proto": "https",
  } });
  assert.equal(api.response.status, 200);
  assert.deepEqual(JSON.parse(api.body), { service: "synthetic-api", version: "0.2.0", status: "UP" });
  const observed = fixtureRequest(s);
  assert.equal(observed.path, "/api/v1/system/status?token=synthetic-query-canary");
  assert.equal(observed.forwardedProto, "http");
  assert.ok(!observed.forwardedFor.includes("198.51.100.99"));
  assert.equal((await get(s, "/api")).response.status, 404);
  assert.equal((await get(s, "/control/down")).response.status, 404);
  const assets = [...page.body.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(m => m[1]);
  assert.ok(assets.length);
  for (const asset of new Set(assets)) {
    const result = await get(s, asset.replaceAll("&amp;", "&"));
    assert.equal(result.response.status, 200);
    assert.doesNotMatch(result.body, /http:\/\/api:8080|API_INTERNAL_URL|synthetic-private-error/);
  }
  await privacy(s);
  console.log("Routing, SSR, headers, forwarded-header trust, assets and log privacy passed");
}
async function privacy(s) {
  await sleep(200);
  const logs = compose(s, ["logs", "--no-color", "--no-log-prefix", "web", "caddy"]);
  assert.doesNotMatch(logs, /synthetic-(?:query|auth|cookie)-canary|synthetic-private-error|api:8080|err_trace|err_id|ResponseError/);
  const entries = logs.split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l));
  const access = entries.filter(e => e.logger?.startsWith("http.log.access"));
  assert.ok(access.length, "Access logs must remain observable");
  for (const e of access) {
    const allowed = new Set(["level", "ts", "logger", "msg", "bytes_read", "duration", "size", "status", "route"]);
    assert.ok(Object.keys(e).every(key => allowed.has(key)), "Unexpected access log field");
    assert.equal(e.request, undefined); assert.equal(e.resp_headers, undefined);
    assert.equal(typeof e.status, "number"); assert.equal(typeof e.duration, "number");
  }
}
async function unavailable(s) {
  try {
    for (const mode of ["down", "stall", "refused", "missing"]) {
      if (mode === "missing") { ownFixture(s); docker(["network", "disconnect", s.network, s.fixture]); }
      else control(s, mode);
      const start = Date.now();
      const page = await get(s, "/system-status");
      assert.ok(Date.now() - start < 12_000);
      assert.equal(page.response.status, 200);
      assert.match(page.body, /Service status is currently unavailable/);
      assert.doesNotMatch(page.body, /synthetic-api|synthetic-private-error/);
      const api = await get(s, "/api/v1/system/status?token=synthetic-query-canary");
      assert.ok([502, 503, 504].includes(api.response.status));
      if (mode !== "down") assert.equal(api.body, "");
      assert.equal((await get(s, "/healthz")).response.status, 200);
      await healthy(s);
      await privacy(s);
      if (mode === "missing") docker(["network", "connect", "--alias", "api", s.network, s.fixture]);
      control(s, "up");
      await routing(s);
    }
  } finally {
    if (!inspect("container", s.fixture).NetworkSettings.Networks[s.network]) docker(["network", "connect", "--alias", "api", s.network, s.fixture]);
    control(s, "up");
  }
  console.log("API HTTP error, stalled response, refused connection, absent DNS and recovery passed");
}
async function restart(s) {
  ownFixture(s);
  const before = inspect("container", s.fixture);
  const caddy = service(s, "caddy");
  const volumes = inspect("container", caddy).Mounts.filter(v => v.Type === "volume").map(v => v.Name).sort();
  docker(["exec", caddy, "sh", "-c", "printf preserved > /data/smoke-marker; printf preserved > /config/smoke-marker"]);
  compose(s, ["restart", "web", "caddy"]);
  await healthy(s);
  synchronizeSmokeOrigin(s);
  await routing(s);
  compose(s, ["up", "--detach", "--force-recreate", "--wait", "--wait-timeout", "90", "web", "caddy"]);
  const afterCaddy = service(s, "caddy");
  synchronizeSmokeOrigin(s);
  assert.deepEqual(inspect("container", afterCaddy).Mounts.filter(v => v.Type === "volume").map(v => v.Name).sort(), volumes);
  assert.equal(docker(["exec", afterCaddy, "cat", "/data/smoke-marker", "/config/smoke-marker"]), "preservedpreserved");
  const after = inspect("container", s.fixture);
  assert.equal(after.Id, before.Id); assert.equal(after.State.StartedAt, before.State.StartedAt); assert.equal(after.RestartCount, before.RestartCount);
  await routing(s);
  console.log("Web/Caddy restart and recreation preserve volumes and leave independent fixture untouched");
}
async function down() {
  if (!existsSync(statePath)) return;
  const s = readState();
  // Project names are random and state is validated; fixture/network additionally carry ownership labels.
  compose(s, ["down", "--volumes", "--timeout", "10"]);
  const fixtures = docker(["container", "ls", "--all", "--quiet", "--filter", `name=^/${s.fixture}$`]);
  if (fixtures) { ownFixture(s); docker(["rm", "--force", s.fixture]); }
  const networks = docker(["network", "ls", "--quiet", "--filter", `name=^${s.network}$`]);
  if (networks) {
    assert.equal(inspect("network", s.network).Labels[label], s.id);
    docker(["network", "rm", s.network]);
  }
  unlinkSync(statePath);
  console.log("Owned smoke resources removed; shared and backend resources untouched");
}

// Release storage is outside Git. Exclusive directory locks deliberately survive
// process termination: an administrator must investigate before unlocking.
export function releaseStore(root) {
  mkdirSync(join(root, "records"), { recursive: true, mode: 0o700 });
  const atomic = (file, value) => {
    const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    const fd = openSync(temp, "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, file);
    if (process.platform !== "win32") {
      const directory = openSync(dirname(file), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
    }
  };
  const recordPath = id => { assert.match(id, /^[a-f0-9]{32}$/); return join(root, "records", `${id}.json`); };
  return {
    lock() { mkdirSync(join(root, "lock"), { mode: 0o700 }); },
    unlock() { rmdirSync(join(root, "lock")); },
    state() { return validateDeploymentState(existsSync(join(root, "state.json")) ? JSON.parse(readFileSync(join(root, "state.json"))) : { current: null, previous: null, pending: null }); },
    saveState(value) { atomic(join(root, "state.json"), validateDeploymentState(value)); },
    record(id) { const value = validateReleaseRecord(JSON.parse(readFileSync(recordPath(id)))); assert.equal(value.id, id); return value; },
    saveRecord(value) { assert.ok(!existsSync(recordPath(value.id))); atomic(recordPath(value.id), validateReleaseRecord(value)); },
    audit(id, value) { assert.match(id, /^[a-f0-9]{32}$/); atomic(join(root, `${id}.json`), value); },
  };
}

export async function releaseTransaction(request, store, operations) {
  validateReleaseRequest(request);
  store.lock();
  const id = randomBytes(16).toString("hex");
  let phase = "resolve";
  let journal = { operation: request.operation, workflowRun: request.workflowRun };
  try {
    const state = store.state();
    for (const previous of [state.current, state.previous].filter(Boolean)) assert.equal(store.record(previous).environment, request.environment);
    if (request.operation === "deploy") assert.equal(state.pending, null, "An interrupted/failed release requires explicit rollback or administrator recovery");
    let target;
    if (request.operation === "rollback") {
      assert.ok(state.current, "No successful release exists to roll back");
      target = store.record(request.record);
      assert.equal(target.environment, request.environment);
    } else target = { config: request.config, apiImage: request.apiImage, apiVersion: request.apiVersion,
      manifest: await operations.evidence(request.sha) };
    validateReleaseManifest(target.manifest, request.operation === "deploy" ? request.sha : target.manifest.sha);
    const record = { id, status: "success", environment: request.environment, config: target.config,
      manifest: target.manifest, apiImage: target.apiImage, apiVersion: target.apiVersion,
      workflowRun: request.workflowRun, operation: request.operation, restoredFrom: request.operation === "rollback" ? request.record : null,
      createdAt: new Date().toISOString() };
    validateReleaseRecord(record);
    phase = "preflight";
    await operations.prepare(record);
    // Record the previous successful release before replacing either service.
    journal = { ...journal, request, previous: state.current, target: record };
    store.audit(id, { ...journal, phase: "prepared" });
    store.saveState({ ...state, pending: id });
    phase = "apply";
    await operations.apply(record);
    phase = "verify";
    await operations.verify(record);
    store.saveRecord(record);
    store.saveState({ current: id, previous: state.current, pending: null });
    store.audit(id, { phase: "success", previous: state.current, record: id });
    return record;
  } catch {
    store.audit(id, { ...journal, phase: "failed", stage: phase });
    throw new Error(`Web release failed during ${phase}; previous successful release retained; explicit rollback may be required`);
  } finally { store.unlock(); }
}

function rootOwned(path, secret = false) {
  let current = resolve(path);
  for (;;) {
    const stat = lstatSync(current);
    assert.equal(stat.uid, 0); assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.mode & (secret && current === resolve(path) ? 0o077 : 0o022), 0);
    if (dirname(current) === current) break;
    current = dirname(current);
  }
}

export async function readReleaseRequest(stream) {
  let content = "";
  const timer = setTimeout(() => stream.destroy(new Error("Request input timed out")), 5000);
  try {
    for await (const chunk of stream) { content += chunk; assert.ok(Buffer.byteLength(content) <= 4096); }
    return validateReleaseRequest(JSON.parse(content));
  } finally { clearTimeout(timer); }
}

export async function dispatchRelease() {
  const e = process.env;
  assert.equal(e.GITHUB_REPOSITORY, releaseRepository); assert.equal(e.GITHUB_REF, "refs/heads/main");
  assert.equal(e.GITHUB_EVENT_NAME, "workflow_dispatch"); assert.equal(e.WEB_DEPLOY_ENABLED, "true");
  const request = validateReleaseRequest({ operation: e.RELEASE_OPERATION, environment: e.RELEASE_ENVIRONMENT,
    workflowRun: e.GITHUB_RUN_ID, ...(e.RELEASE_OPERATION === "deploy" ? {
      sha: e.RELEASE_SHA, config: e.RELEASE_CONFIG, apiImage: e.RELEASE_API_IMAGE, apiVersion: e.RELEASE_API_VERSION,
    } : { record: e.RELEASE_RECORD }) });
  if (request.operation === "deploy") await getReleaseEvidence(request.sha, e.GH_TOKEN);
  assert.match(e.WEB_DEPLOY_HOST ?? "", /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/);
  assert.match(e.WEB_DEPLOY_USER ?? "", /^[a-z_][a-z0-9_-]{0,31}$/);
  assert.match(e.WEB_DEPLOY_PORT ?? "", /^[0-9]{1,5}$/);
  assert.ok(Number(e.WEB_DEPLOY_PORT) > 0 && Number(e.WEB_DEPLOY_PORT) <= 65535);
  assert.ok(e.WEB_DEPLOY_SSH_KEY && e.WEB_DEPLOY_KNOWN_HOSTS);
  validateSite(e.WEB_DEPLOY_ORIGIN);
  assert.equal(e.WEB_DEPLOY_ORIGIN, `https://${new URL(e.WEB_DEPLOY_ORIGIN).hostname}`);
  const directory = mkdtempSync(join(tmpdir(), "web-deploy-ssh-"));
  try {
    const key = join(directory, "key"), hosts = join(directory, "known_hosts");
    writeFileSync(key, e.WEB_DEPLOY_SSH_KEY, { mode: 0o600 });
    writeFileSync(hosts, e.WEB_DEPLOY_KNOWN_HOSTS, { mode: 0o600 });
    const output = execFileSync("ssh", ["-F", "/dev/null", "-T", "-i", key, "-p", e.WEB_DEPLOY_PORT,
      "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
      "-o", `UserKnownHostsFile=${hosts}`, "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15",
      "-o", "ServerAliveCountMax=3", `${e.WEB_DEPLOY_USER}@${e.WEB_DEPLOY_HOST}`, "web-release"], {
      encoding: "utf8", input: JSON.stringify(request), stdio: ["pipe", "pipe", "pipe"], timeout: 1_200_000,
      env: { PATH: "/usr/bin:/bin", HOME: directory }, maxBuffer: 4096,
    });
    const result = JSON.parse(output);
    assert.equal(result.status, "success"); assert.match(result.record, /^[a-f0-9]{32}$/);
    assert.match(result.sha, /^[a-f0-9]{40}$/); assert.equal(result.operation, request.operation);
    // Runner also verifies public routing after the host verifies its own origin.
    // Version for rollback is returned only from the validated successful record.
    assert.match(result.apiVersion, /^[a-zA-Z0-9][a-zA-Z0-9.+-]{0,127}$/);
    await verifyReleaseHttp(e.WEB_DEPLOY_ORIGIN, result.apiVersion);
    console.log(`Web ${result.operation} passed; release record ${result.record}; SHA ${result.sha}`);
    if (e.GITHUB_STEP_SUMMARY) writeFileSync(e.GITHUB_STEP_SUMMARY,
      `Web ${result.operation} passed\n\nRelease record: \`${result.record}\`\n\nSHA: \`${result.sha}\`\n`, { flag: "a" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function validateDeployAuthorization(request, run, reviews) {
  assert.ok(["non-production", "production"].includes(request.environment));
  assert.equal(run.repository?.full_name, releaseRepository);
  assert.equal(run.head_repository?.full_name, releaseRepository);
  assert.equal(run.path, ".github/workflows/deploy.yml");
  assert.equal(run.event, "workflow_dispatch"); assert.equal(run.head_branch, "main");
  assert.equal(run.status, "in_progress"); assert.equal(String(run.id), request.workflowRun);
  const decisions = reviews.filter(r => r.environments?.some(e => e.name === request.environment));
  // Do not rely on undocumented ordering or reuse a rejected run's approval.
  assert.ok(decisions.every(r => r.state === "approved"), "Environment review rejected this run");
  if (request.environment === "production") {
    assert.ok(decisions.length > 0, "Protected production environment approval is required");
  }
}

// Called only by the root-owned fixed SSH entry point; no caller-supplied paths.
export async function deployHost(stream = process.stdin) {
  assert.equal(process.platform, "linux"); assert.equal(process.getuid(), 0);
  const request = await readReleaseRequest(stream);
  const base = "/etc/medical-web-deploy";
  const root = "/var/lib/medical-web-deploy";
  rootOwned(join(base, "host.json")); rootOwned(join(base, "github-token"), true);
  rootOwned(join(base, "docker", "config.json"), true); rootOwned(root, true);
  const host = JSON.parse(readFileSync(join(base, "host.json")));
  assert.deepEqual(Object.keys(host).sort(), ["apiContainer", "apiRepository", "environment", "origin"]);
  assert.equal(request.environment, host.environment);
  assert.equal(host.origin, `https://${new URL(host.origin).hostname}`);
  validateSite(host.origin);
  assert.match(host.apiContainer, /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/);
  validateImage(`${host.apiRepository}:${"0".repeat(40)}`);
  const token = readFileSync(join(base, "github-token"), "utf8").trim();
  const apiBase = `/repos/${releaseRepository}/actions/runs/${request.workflowRun}`;
  const run = await githubJson(apiBase, token);
  const reviews = await githubJson(`${apiBase}/approvals`, token);
  validateDeployAuthorization(request, run, reviews);
  // Explicit clean environment for all privileged Docker/Compose processes.
  process.env = { PATH: "/usr/bin:/bin", HOME: root, DOCKER_CONFIG: join(base, "docker") };
  const store = releaseStore(root);
  let configuration;
  let expectedIds;
  const project = "professional-services-medical-web";
  const network = "professional-services-edge";
  const apiIdentity = record => verifyApiIdentity(inspect("container", host.apiContainer), record.apiImage, inspect("image", record.apiImage), network);
  const composeRelease = (record, args) => docker(["compose", "--project-name", project, "--env-file", "/dev/null", "-f", join(configuration, "compose.yaml"), ...args], {
    WEB_IMAGE: record.manifest.web.image, CADDY_IMAGE: record.manifest.caddy.image, SITE_ADDRESS: new URL(host.origin).hostname, EDGE_NETWORK: network,
    PUBLIC_ORIGIN: host.origin,
  });
  const operations = {
    evidence: sha => getReleaseEvidence(sha, token),
    async prepare(record) {
      assert.equal(record.apiImage.slice(0, record.apiImage.lastIndexOf(":")), host.apiRepository);
      configuration = join(base, "configurations", record.config);
      for (const [key, file] of [["compose", "compose.yaml"], ["caddy", "Caddyfile"]]) {
        const path = join(configuration, file); rootOwned(path);
        assert.equal(hashBytes(readFileSync(path)), record.manifest.configuration[key]);
      }
      const config = JSON.parse(composeRelease(record, ["config", "--format", "json"]));
      validateTopology(config);
      assert.equal(config.networks.edge.name, network);
      assert.equal(config.services.caddy.volumes.find(v => v.target === "/etc/caddy/Caddyfile").source, join(configuration, "Caddyfile"));
      apiIdentity(record);
      const state = store.state();
      if (!state.current) {
        assert.equal(composeRelease(record, ["ps", "--all", "--quiet", "web", "caddy"]), "", "Unrecorded existing web stack requires administrator reconciliation");
      } else if (request.operation === "deploy") {
        const current = store.record(state.current);
        const previousConfiguration = join(base, "configurations", current.config);
        for (const [key, file] of [["compose", "compose.yaml"], ["caddy", "Caddyfile"]]) {
          rootOwned(join(previousConfiguration, file));
          assert.equal(hashBytes(readFileSync(join(previousConfiguration, file))), current.manifest.configuration[key]);
        }
        for (const service of ["web", "caddy"]) {
          const detail = inspect("container", composeRelease(record, ["ps", "--all", "--quiet", service]));
          assert.equal(detail.Config.Image, current.manifest[service].image);
          validatePulledReleaseImage(current.manifest, service, inspect("image", detail.Image));
          if (service === "caddy") assert.equal(detail.Mounts.find(m => m.Destination === "/etc/caddy/Caddyfile")?.Source, join(previousConfiguration, "Caddyfile"));
        }
      }
      expectedIds = {};
      for (const service of ["web", "caddy"]) {
        const selected = record.manifest[service];
        docker(["pull", selected.image]);
        const detail = inspect("image", selected.image);
        expectedIds[service] = validatePulledReleaseImage(record.manifest, service, detail);
      }
      await candidateProbe(record, configuration, network, root);
    },
    async apply(record) {
      apiIdentity(record);
      composeRelease(record, ["up", "--detach", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "120", "web", "caddy"]);
    },
    async verify(record) {
      for (const service of ["web", "caddy"]) {
        const id = composeRelease(record, ["ps", "--all", "--quiet", service]);
        const detail = inspect("container", id);
        assert.equal(detail.Config.Labels["com.docker.compose.project"], project);
        assert.equal(detail.Image, expectedIds[service]);
        assert.equal(detail.State.Health?.Status, "healthy");
      }
      await waitReleaseHttp(host.origin, record.apiVersion);
      apiIdentity(record);
    },
  };
  const record = await releaseTransaction(request, store, operations);
  console.log(JSON.stringify({ status: "success", record: record.id, sha: record.manifest.sha, operation: record.operation, apiVersion: record.apiVersion }));
}

async function waitReleaseHttp(url, version) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try { await verifyReleaseHttp(url, version, deadline); return; } catch { /* Bounded readiness retry; never log raw responses. */ }
    await sleep(Math.min(1000, Math.max(0, deadline - Date.now())));
  }
  throw new Error("Release HTTP verification timed out");
}

async function candidateProbe(record, configuration, network, root) {
  const id = `web-probe-${randomBytes(16).toString("hex")}`;
  const web = `${id}-web`, caddy = `${id}-caddy`;
  const file = join(root, `${id}.Caddyfile`);
  const text = readFileSync(join(configuration, "Caddyfile"), "utf8");
  assert.equal(text.split("web:3000").length, 2);
  writeFileSync(file, text.replace("web:3000", `${web}:3000`), { flag: "wx", mode: 0o600 });
  try {
    docker(["run", "--detach", "--name", web, "--label", `${label}=${id}`, "--network", network,
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "512m", "--cpus", "1",
      "--log-driver", "none", "-e", "API_INTERNAL_URL=http://api:8080", "-e", "PUBLIC_ORIGIN=http://127.0.0.1", record.manifest.web.image]);
    docker(["run", "--detach", "--name", caddy, "--label", `${label}=${id}`, "--network", network,
      "--security-opt", "no-new-privileges", "--memory", "256m", "--cpus", "0.5", "--log-driver", "none",
      "--publish", "127.0.0.1::80", "--mount", `type=bind,src=${file},dst=/etc/caddy/Caddyfile,readonly`,
      "--tmpfs", "/data", "--tmpfs", "/config", "-e", "SITE_ADDRESS=http://:80", record.manifest.caddy.image]);
    const port = docker(["port", caddy, "80/tcp"]);
    assert.match(port, /^127\.0\.0\.1:\d+$/);
    await waitReleaseHttp(`http://${port}`, record.apiVersion);
  } finally {
    // Remove only exact, owned temporary names; never backend/project resources.
    let cleanupFailed = false;
    for (const name of [caddy, web]) {
      try {
        if (docker(["container", "ls", "--all", "--quiet", "--filter", `name=^/${name}$`])) {
          assert.equal(inspect("container", name).Config.Labels[label], id);
          docker(["rm", "--force", name]);
        }
      } catch { cleanupFailed = true; }
    }
    unlinkSync(file);
    assert.equal(cleanupFailed, false, "Candidate cleanup failed; administrator inspection required");
  }
}

async function releaseSmoke(rollbackOnly) {
  assert.ok(!existsSync(statePath), "Finish existing integration run first");
  mkdirSync(resolve("reports"), { recursive: true });
  const root = mkdtempSync(join(resolve("reports"), "release-smoke-"));
  const images = [];
  const owner = randomBytes(16).toString("hex");
  try {
    await up();
    const s = readState();
    const before = inspect("container", s.fixture);
    const caddyBefore = inspect("container", service(s, "caddy"));
    const volumes = caddyBefore.Mounts.filter(v => v.Type === "volume").map(v => v.Name).sort();
    docker(["exec", caddyBefore.Id, "sh", "-c", "printf preserved > /data/release-marker; printf preserved > /config/release-marker"]);
    const manifests = [];
    for (const revision of [randomBytes(20).toString("hex"), randomBytes(20).toString("hex")]) {
      const manifest = { schema: 1, repository: releaseRepository, sha: revision, runId: "1", attempt: 1, clientVersion,
        configuration: { compose: hashBytes(readFileSync("deployment/compose.yaml")), caddy: hashBytes(readFileSync("deployment/Caddyfile")) } };
      for (const name of ["web", "caddy"]) {
        const base = name === "web" ? s.image : s.caddyImage;
        const image = `${releaseImages[name]}:${revision}`;
        // Local synthetic identities only: deliberately no publication/provenance claim.
        execFileSync("docker", ["build", "--network", "none", "--tag", image, "--label", `org.opencontainers.image.revision=${revision}`,
          "--label", `io.professional-services.release-test=${owner}`, "-"], {
          input: `FROM ${base}\n`, stdio: ["pipe", "pipe", "pipe"], timeout: 300_000,
        });
        images.push(image);
        manifest[name] = { image, digest: inspect("image", image).Id, revision, ...(name === "web" ? { clientVersion } : {}) };
      }
      manifests.push(validateReleaseManifest(manifest, revision));
    }
    // Prove bootstrap with no existing web/Caddy containers, preserving their volumes.
    compose(s, ["rm", "--stop", "--force", "web", "caddy"]);
    const store = releaseStore(root);
    const request = { operation: "deploy", environment: "non-production", workflowRun: "1", sha: manifests[0].sha,
      config: "synthetic", apiImage: `synthetic/api:${"1".repeat(40)}`, apiVersion: "0.2.0" };
    const operations = {
      evidence: async sha => manifests.find(m => m.sha === sha),
      async prepare(record) {
        if (store.state().current) await verifyReleaseHttp(origin(s), record.apiVersion);
        await candidateProbe(record, resolve("deployment"), s.network, root);
      },
      async apply(record) {
        s.image = record.manifest.web.image; s.caddyImage = record.manifest.caddy.image;
        writeFileSync(statePath, JSON.stringify(s, null, 2));
        compose(s, ["up", "--detach", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "120", "web", "caddy"]);
        synchronizeSmokeOrigin(s);
      },
      async verify(record) {
        for (const name of ["web", "caddy"]) assert.equal(inspect("container", service(s, name)).Image, inspect("image", record.manifest[name].image).Id);
        await verifyReleaseHttp(origin(s), record.apiVersion);
      },
    };
    const a = await releaseTransaction(request, store, operations);
    if (!rollbackOnly) {
      const original = inspect("container", service(s, "web")).Id;
      try {
        control(s, "down");
        await assert.rejects(releaseTransaction({ ...request, sha: manifests[1].sha }, store, operations), /preflight/);
        assert.equal(inspect("container", service(s, "web")).Id, original);
        assert.equal(store.state().current, a.id);
      } finally { control(s, "up"); }
    }
    const b = await releaseTransaction({ ...request, sha: manifests[1].sha }, store, operations);
    assert.notEqual(inspect("image", a.manifest.web.image).Id, inspect("image", b.manifest.web.image).Id);
    if (!rollbackOnly) {
      const verify = operations.verify;
      operations.verify = async record => { control(s, "down"); await verify(record); };
      try {
        await assert.rejects(releaseTransaction(request, store, operations), /verify/);
        assert.equal(store.state().current, b.id); assert.ok(store.state().pending);
      } finally { control(s, "up"); operations.verify = verify; }
    }
    const target = rollbackOnly ? a : b;
    const restored = await releaseTransaction({ operation: "rollback", environment: "non-production", workflowRun: "2", record: target.id }, store, operations);
    assert.equal(restored.manifest.sha, target.manifest.sha);
    assert.equal(store.state().pending, null);
    const caddyAfter = inspect("container", service(s, "caddy"));
    assert.deepEqual(caddyAfter.Mounts.filter(v => v.Type === "volume").map(v => v.Name).sort(), volumes);
    assert.equal(docker(["exec", caddyAfter.Id, "cat", "/data/release-marker", "/config/release-marker"]), "preservedpreserved");
    const after = inspect("container", s.fixture);
    assert.equal(after.Id, before.Id); assert.equal(after.State.StartedAt, before.State.StartedAt); assert.equal(after.RestartCount, before.RestartCount);
    console.log(`Synthetic ${rollbackOnly ? "A-to-B-to-A rollback" : "release, unavailable preflight and failed verification recovery"} passed; backend identity and Caddy volumes preserved. Protected VPS proof remains separate.`);
  } finally {
    await down();
    for (const image of images) {
      assert.equal(inspect("image", image).Config.Labels["io.professional-services.release-test"], owner);
      docker(["image", "rm", image]);
    }
    assert.equal(dirname(root), resolve("reports"));
    rmSync(root, { recursive: true, force: true });
  }
}

async function main() {
const command = process.argv[2];
try {
  if (command === "validate") await validate();
  else if (command === "edge-network") { ensureNetwork(process.env.EDGE_NETWORK ?? "professional-services-edge"); console.log("Edge network ready"); }
  else if (command === "up") await up();
  else if (command === "down") await down();
  else if (command === "routing") await routing(readState());
  else if (command === "unavailable") await unavailable(readState());
  else if (command === "restart") await restart(readState());
  else if (command === "fixture-up") control(readState(), "up");
  else if (command === "fixture-down") control(readState(), "down");
  else if (command === "release-smoke") await releaseSmoke(false);
  else if (command === "rollback-smoke") await releaseSmoke(true);
  else if (command === "all") {
    assert.ok(!existsSync(statePath), "Finish the existing smoke run before starting all checks");
    try { await validate(); await up(); const s = readState(); await routing(s); await unavailable(s); await restart(s); }
    finally { await down(); }
  } else throw new Error("Expected validate, edge-network, up, down, routing, unavailable, restart, or all");
} catch (error) {
  // Assertions can embed response bodies; keep CI diagnostics free of raw data.
  console.error(error.code === "ERR_ASSERTION" ? `Integration assertion failed in ${command}; inspect synthetic results locally` : error.message);
  process.exitCode = 1;
}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
