// Read-only proof against an independently provisioned non-production stack.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { validateImage } from "./production-config.mjs";
import { checkClient } from "./check-api-client-version.mjs";

try {
  const image = validateImage(process.env.API_IMAGE);
  const expectedVersion = process.env.EXPECTED_API_VERSION;
  assert.ok(expectedVersion && /^[a-zA-Z0-9.+-]+$/.test(expectedVersion));
  const origin = process.env.COMPATIBILITY_ORIGIN;
  assert.match(origin ?? "", /^http:\/\/127\.0\.0\.1:\d+$/);
  const inspect = name => {
    assert.match(name ?? "", /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/);
    return JSON.parse(execFileSync("docker", ["container", "inspect", name], { encoding: "utf8", stdio: "pipe" }))[0];
  };
  const api = inspect(process.env.API_CONTAINER);
  const web = inspect(process.env.COMPATIBILITY_WEB_CONTAINER);
  const caddy = inspect(process.env.COMPATIBILITY_CADDY_CONTAINER);
  assert.equal(api.Config.Image, image);
  const selectedId = execFileSync("docker", ["image", "inspect", image, "--format", "{{.Id}}"], { encoding: "utf8", stdio: "pipe" }).trim();
  assert.equal(api.Image, selectedId);
  assert.equal(api.State.Running, true);
  assert.ok(!api.Config.Labels?.["io.professional-services.web-smoke"], "Synthetic fixtures cannot prove API compatibility");
  const shared = Object.entries(api.NetworkSettings.Networks).find(([name, n]) => n.Aliases?.includes("api") && web.NetworkSettings.Networks[name]?.Aliases?.includes("web") && caddy.NetworkSettings.Networks[name]);
  assert.ok(shared);
  const port = new URL(origin).port;
  assert.ok(caddy.NetworkSettings.Ports["80/tcp"]?.some(p => p.HostIp === "127.0.0.1" && p.HostPort === port));
  const client = checkClient(JSON.parse(readFileSync("package.json")), JSON.parse(readFileSync("package-lock.json")));
  validateImage(web.Config.Image);
  assert.equal(web.Config.Labels["io.professional-services.api-client.version"], client);
  const request = async path => {
    const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(12_000), redirect: "error" });
    assert.equal(response.status, 200);
    return response;
  };
  const status = await (await request("/api/v1/system/status")).json();
  assert.equal(status.version, expectedVersion);
  assert.equal(status.status, "UP");
  const html = await (await request("/system-status")).text();
  assert.ok(html.includes(expectedVersion));
  assert.ok(!html.includes("Service status is currently unavailable"));
  assert.deepEqual(await (await request("/healthz")).json(), { status: "ok" });
  console.log(`Read-only API compatibility passed: image=${image}; version=${expectedVersion}; client=${client}`);
} catch {
  console.error("Compatibility check failed: verify explicit API identity/version and independently provisioned loopback stack; no containers were modified");
  process.exitCode = 1;
}
