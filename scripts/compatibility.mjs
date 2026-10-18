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

export async function verifyReleaseHttp(origin, expectedVersion, deadline = Date.now() + 120_000) {
  const request = async (path, allowLocaleRedirect = false) => {
    const remaining = deadline - Date.now();
    assert.ok(remaining > 0, "Release verification deadline exceeded");
    const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(Math.min(12_000, remaining)), redirect: "manual" });
    assert.equal(response.headers.get("server"), null);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(response.headers.get("strict-transport-security"), origin.startsWith("https:") ? "max-age=31536000" : null);
    if (allowLocaleRedirect && response.status === 307) {
      const destination = response.headers.get("location");
      assert.match(destination ?? "", /^\/[a-z]{2}(?:-[A-Za-z0-9]{2,8})*$/);
      await response.body?.cancel();
      return request(destination);
    }
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.doesNotMatch(body, /http:\/\/api:8080|API_INTERNAL_URL|ResponseError|err_trace/);
    return { body, headers: response.headers };
  };
  const health = await request("/healthz");
  assert.deepEqual(JSON.parse(health.body), { status: "ok" });
  assert.equal(health.headers.get("cache-control"), "no-store");
  const api = JSON.parse((await request("/api/v1/system/status")).body);
  assert.equal(api.version, expectedVersion); assert.equal(api.status, "UP");
  assert.equal(typeof api.service, "string"); assert.ok(api.service.length);
  const page = (await request("/system-status")).body;
  assert.match(page, /<main\b/); assert.match(page, /<dl\b/);
  assert.ok(page.includes(expectedVersion));
  assert.ok(!page.includes("Service status is currently unavailable"));
  for (const html of [page, (await request("/", true)).body]) {
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, /<meta name="robots" content="noindex,\s*nofollow"/);
  }
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
