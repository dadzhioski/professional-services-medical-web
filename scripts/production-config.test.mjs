import { test } from "node:test";
import assert from "node:assert/strict";
import { validateImage, validateSite, validateTopology } from "./production-config.mjs";

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
