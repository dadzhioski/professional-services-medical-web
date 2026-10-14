import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { validateImage, validateSite, validateTopology } from "./production-config.mjs";
import { checkClient } from "./check-api-client-version.mjs";

const statePath = resolve("reports/integration-state.json");
const clientVersion = checkClient(JSON.parse(readFileSync("package.json")), JSON.parse(readFileSync("package-lock.json")));
const label = "io.professional-services.web-smoke";
const sleep = ms => new Promise(r => setTimeout(r, ms));
function docker(args, env = {}) {
  try {
    return execFileSync("docker", args, { encoding: "utf8", stdio: "pipe", timeout: 120_000,
      env: { ...process.env, ...env } }).trim();
  } catch { throw new Error(`Docker ${args[0]} ${args[1] ?? ""} failed (raw output withheld; inspect synthetic resources locally)`); }
}
const inspect = (kind, name) => JSON.parse(docker([kind, "inspect", name]))[0];
function compose(state, args) {
  return docker(["compose", "--project-name", state.id, "--env-file", resolve(".env.production.example"),
    "-f", resolve("deployment/compose.yaml"), ...(state.smoke ? ["-f", resolve("deployment/compose.smoke.yaml")] : []), ...args], {
    WEB_IMAGE: state.image, CADDY_IMAGE: state.caddyImage, SITE_ADDRESS: state.site ?? "medical.example.test", EDGE_NETWORK: state.network,
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
    s.origin = origin(s);
    writeFileSync(statePath, JSON.stringify(s, null, 2));
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
  s.origin = origin(s);
  writeFileSync(statePath, JSON.stringify(s, null, 2));
  await routing(s);
  compose(s, ["up", "--detach", "--force-recreate", "--wait", "--wait-timeout", "90", "web", "caddy"]);
  const afterCaddy = service(s, "caddy");
  s.origin = origin(s);
  writeFileSync(statePath, JSON.stringify(s, null, 2));
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
