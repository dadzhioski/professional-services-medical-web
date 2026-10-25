import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEdgeLimits, validateImage, validateSite, validateTopology } from "./production-config.mjs";

test("release image validation rejects mutable and malformed identities", () => {
  for (const image of [undefined, "", "web", "web:", "web:latest", "web:main", "web:abcdef0", `web:sha-${"a".repeat(40)}`, `web:${"A".repeat(40)}`, `web:${"a".repeat(40)}\n`, `web:${"a".repeat(40)}@sha256:${"b".repeat(64)}`]) {
    assert.throws(() => validateImage(image));
  }
  for (const repo of ["web", "ghcr.io/example/medical-web", "localhost:5000/example/web"]) {
    assert.equal(validateImage(`${repo}:${"a".repeat(40)}`), `${repo}:${"a".repeat(40)}`);
  }
});

test("production site accepts a single HTTPS hostname, never Caddyfile injection", () => {
  for (const site of [undefined, "", "localhost", "http://medical.example.test", "example.test:443", "example.test/path", "*.example.test", "example.test\nrespond secret", "example.test other.test", "https://user@example.test"]) {
    assert.throws(() => validateSite(site));
  }
  assert.equal(validateSite("medical.example.test"), "medical.example.test");
  assert.equal(validateSite("https://medical.example.test"), "https://medical.example.test");
});

function topology() {
  const operational = { restart: "unless-stopped", mem_limit: 256, logging: { options: { "max-size": "10m", "max-file": "5" } } };
  return { services: {
    web: { ...structuredClone(operational), image: `web:${"a".repeat(40)}`, networks: { edge: { aliases: ["web"] } }, environment: { API_INTERNAL_URL: "http://api:8080" } },
    caddy: { ...structuredClone(operational), image: `edge:${"a".repeat(40)}`, networks: { edge: {} }, healthcheck: { test: ["CMD", "wget"] },
      ports: [{ target: 80, published: "80", protocol: "tcp" }, { target: 443, published: "443", protocol: "tcp" }, { target: 443, published: "443", protocol: "udp" }],
      volumes: [{ type: "volume", target: "/data" }, { type: "volume", target: "/config" }, { type: "bind", target: "/etc/caddy/Caddyfile", read_only: true }] },
  }, networks: { edge: { external: true } } };
}
test("deployment policy rejects accidental public exposure and boundary drift", () => {
  validateTopology(topology());
  for (const mutate of [
    c => { c.services.web.ports = [{ target: 3000, published: "3000" }]; },
    c => { c.services.api = {}; },
    c => { c.services.web.networks.edge.aliases = []; },
    c => { c.networks.edge.external = false; },
    c => { c.services.caddy.volumes = []; },
    c => { c.services.caddy.image = "edge:latest"; },
    c => { c.services.caddy.ports.push({ target: 2019, published: "2019", protocol: "tcp" }); },
  ]) {
    const config = topology(); mutate(config);
    assert.throws(() => validateTopology(config));
  }
});
test("smoke policy rejects inherited public bindings", () => {
  const config = topology();
  assert.throws(() => validateTopology(config, true));
  config.services.caddy.ports = [{ target: 80, published: "0", host_ip: "127.0.0.1", protocol: "tcp" }];
  validateTopology(config, true);
  config.services.caddy.ports[0].host_ip = "0.0.0.0";
  assert.throws(() => validateTopology(config, true));
});

test("public origin must match the approved HTTPS site; legacy rollback remains valid", () => {
  const config = topology();
  validateTopology(config);
  config.services.caddy.environment = { SITE_ADDRESS: "medical.example.test" };
  for (const value of ["http://medical.example.test", "https://evil.test", "https://medical.example.test/path", "https://medical.example.test/"]) {
    config.services.web.environment.PUBLIC_ORIGIN = value;
    assert.throws(() => validateTopology(config));
  }
  config.services.web.environment.PUBLIC_ORIGIN = "https://medical.example.test";
  validateTopology(config);
});

test("only upload pages get the longer edge timeout and larger body limit", () => {
  const proxy = (dial, timeouts) => ({ handler: "reverse_proxy", upstreams: [{ dial }], transport: { protocol: "http", ...timeouts } });
  const s = 1_000_000_000;
  const paths = ["mk", "en"].flatMap(l => ["profile", "credentials"].map(p => `/${l}/provider/${p}`));
  const config = (uploadPaths = paths, uploadTimeout = 50 * s, webLimit = 1_000_000) => ({ apps: { http: { servers: { srv0: { routes: [
    { match: [{ path: ["/api/*"] }], handle: [{ handler: "subroute", routes: [{ handle: [proxy("api:8080", { response_header_timeout: 6 * s })] }] }] },
    { match: [{ method: ["POST"], path: uploadPaths }], handle: [{ handler: "subroute", routes: [{ handle: [
      { handler: "request_body", max_size: 12_000_000 }, proxy("web:3000", { response_header_timeout: uploadTimeout, read_timeout: uploadTimeout, write_timeout: 30 * s })] }] }] },
    { handle: [{ handler: "subroute", routes: [{ handle: [{ handler: "request_body", max_size: webLimit },
      proxy("web:3000", { response_header_timeout: 10 * s, read_timeout: 10 * s, write_timeout: 10 * s })] }] }] },
  ] } } } } });
  const expected = { locales: ["mk", "en"], uploadPages: ["profile", "credentials"], uploadBudgetMs: 40_000 };
  validateEdgeLimits(config(), expected);
  const hosted = config();
  hosted.apps.http.servers.srv0.routes = [{ match: [{ host: ["medical.example.test"] }], handle: [{ handler: "subroute", routes: hosted.apps.http.servers.srv0.routes }] }];
  validateEdgeLimits(hosted, expected);
  assert.throws(() => validateEdgeLimits(config(paths.slice(1)), expected));
  assert.throws(() => validateEdgeLimits(config([...paths, "/en/provider/onboarding"]), expected));
  assert.throws(() => validateEdgeLimits(config(), { ...expected, locales: ["mk", "en", "sq"] }));
  assert.throws(() => validateEdgeLimits(config(paths, 44 * s), expected));
  assert.throws(() => validateEdgeLimits(config(), { ...expected, uploadBudgetMs: 46_000 }));
  assert.throws(() => validateEdgeLimits(config(paths, 50 * s, 12_000_000), expected));
});
