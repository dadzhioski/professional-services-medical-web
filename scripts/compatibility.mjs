// Read-only proof against an independently provisioned non-production stack.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { validateImage } from "./production-config.mjs";
import { checkClient } from "./check-api-client-version.mjs";

export function verifyApiIdentity(api, image, selected, network) {
  validateImage(image);
  // The API may run from the selected tag pinned to a digest that the selected image carries.
  const pin = api.Config.Image.startsWith(image) ? api.Config.Image.slice(image.length) : null;
  assert.ok(pin === "" || (/^@sha256:[a-f0-9]{64}$/.test(pin ?? "") &&
    selected.RepoDigests?.includes(`${image.slice(0, image.lastIndexOf(":"))}${pin}`)), "API container must run the selected image");
  assert.equal(api.Image, selected.Id);
  assert.equal(api.State.Running, true);
  if (api.State.Health) assert.equal(api.State.Health.Status, "healthy");
  assert.ok(!api.Config.Labels?.["io.professional-services.web-smoke"], "Synthetic fixtures cannot prove API compatibility");
  assert.ok(api.NetworkSettings.Networks[network]?.Aliases?.includes("api"));
}

async function main() {
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
  const selected = JSON.parse(execFileSync("docker", ["image", "inspect", image], { encoding: "utf8", stdio: "pipe" }))[0];
  const shared = Object.entries(api.NetworkSettings.Networks).find(([name, n]) => n.Aliases?.includes("api") && web.NetworkSettings.Networks[name]?.Aliases?.includes("web") && caddy.NetworkSettings.Networks[name]);
  assert.ok(shared);
  verifyApiIdentity(api, image, selected, shared[0]);
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
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
