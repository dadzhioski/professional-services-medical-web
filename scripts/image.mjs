import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { checkClient } from "./check-api-client-version.mjs";
import { validateImage, releaseRepository, releaseImages, validateReleaseManifest } from "./production-config.mjs";
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: "inherit", ...options });
const capture = (cmd, args) => run(cmd, args, { encoding: "utf8", stdio: "pipe" }).trim();
const fetchBounded = url => fetch(url, { signal: AbortSignal.timeout(10_000) });
export const hashBytes = bytes => createHash("sha256").update(bytes).digest("hex");

export function imageReleasePart(service, sha) {
  assert.ok(Object.hasOwn(releaseImages, service));
  assert.match(sha, /^[a-f0-9]{40}$/);
  const image = `${releaseImages[service]}:${sha}`;
  const detail = JSON.parse(capture("docker", ["image", "inspect", image]))[0];
  const digests = detail.RepoDigests.filter(d => d.startsWith(`${releaseImages[service]}@`));
  assert.equal(digests.length, 1);
  return { image, digest: digests[0].split("@")[1], revision: detail.Config.Labels["org.opencontainers.image.revision"],
    ...(service === "web" ? { clientVersion: detail.Config.Labels["io.professional-services.api-client.version"] } : {}) };
}

async function main() {
const revision = capture("git", ["rev-parse", "HEAD"]);
const image = process.env.IMAGE ?? `professional-services-medical-web:${revision}`;
validateImage(image);
const version = checkClient(JSON.parse(readFileSync("package.json")), JSON.parse(readFileSync("package-lock.json")));
if (process.argv[2] === "build") {
  if (!image.endsWith(`:${revision}`)) throw new Error("Build tag must match the current commit");
  const npmrc = process.env.NPM_CONFIG_USERCONFIG ?? process.env.npm_config_userconfig ?? resolve(process.env.USERPROFILE ?? process.env.HOME, ".npmrc");
  run("docker", ["build", "--platform", "linux/amd64", "--secret", `id=npmrc,src=${npmrc}`, ...(process.env.NODE_AUTH_TOKEN ? ["--secret", "id=npm_token,env=NODE_AUTH_TOKEN"] : []), "--build-arg", `REVISION=${revision}`, "--build-arg", `API_CLIENT_VERSION=${version}`, "--tag", image, "."]);
} else if (process.argv[2] === "release-part") {
  const service = process.env.PACKAGE === "professional-services-medical-web" ? "web" : "caddy";
  assert.ok(["professional-services-medical-web", "professional-services-medical-edge"].includes(process.env.PACKAGE));
  writeFileSync(`reports/${service}.json`, JSON.stringify(imageReleasePart(service, revision)));
} else if (process.argv[2] === "release-manifest") {
  const manifest = { schema: 1, repository: releaseRepository, sha: revision, runId: process.env.GITHUB_RUN_ID,
    attempt: Number(process.env.GITHUB_RUN_ATTEMPT), clientVersion: version,
    web: JSON.parse(readFileSync("reports/web.json")), caddy: JSON.parse(readFileSync("reports/caddy.json")),
    configuration: { compose: hashBytes(readFileSync("deployment/compose.yaml")), caddy: hashBytes(readFileSync("deployment/Caddyfile")) } };
  validateReleaseManifest(manifest, revision);
  writeFileSync("reports/release.json", JSON.stringify(manifest, null, 2));
} else if (process.argv[2] === "smoke") {
  const id = `web-smoke-${process.pid}`;
  const network = `${id}-network`;
  let createdNetwork = false;
  const containers = [];
  const launch = (name, args) => { run("docker", ["run", "--detach", "--name", name, ...args]); containers.push(name); };
  try {
    assert.equal(capture("docker", ["image", "inspect", image, "--format", "{{.Config.User}}"]), "10001:10001");
    assert.equal(capture("docker", ["image", "inspect", image, "--format", '{{index .Config.Labels "org.opencontainers.image.revision"}}']), image.split(":").at(-1));
    assert.equal(capture("docker", ["image", "inspect", image, "--format", '{{index .Config.Labels "io.professional-services.api-client.version"}}']), version);
    run("docker", ["network", "create", network]); createdNetwork = true;
    for (const [suffix, setting] of [["missing-origin", ""], ["invalid-origin", "http://invalid.example.test"]]) {
      const name = `${id}-${suffix}`;
      launch(name, ["--network", "none", "-e", "API_INTERNAL_URL=http://127.0.0.1:9", "-e", `PUBLIC_ORIGIN=${setting}`, image]);
      // Next keeps its listener alive after a failed instrumentation hook, but
      // must never become healthy or serve application content.
      let status;
      for (let attempt = 0; attempt < 30 && !status; attempt++) {
        try {
          status = capture("docker", ["exec", name, "node", "-e", "fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(2000)}).then(r=>console.log(r.status)).catch(()=>process.exit(1))"]);
        } catch { await new Promise(r => setTimeout(r, 500)); }
      }
      assert.equal(status, "500", "Invalid runtime origin must prevent readiness");
    }
    launch(`${id}-fixture`, ["--network", network, "--network-alias", "fixture", "--mount", `type=bind,src=${resolve("tests/e2e/api-fixture.mjs")},dst=/fixture.mjs,readonly`, "-e", "FIXTURE_HOST=0.0.0.0", "--entrypoint", "node", image, "/fixture.mjs"]);
    launch(id, ["--network", network, "-p", "127.0.0.1::3000", "-e", "API_INTERNAL_URL=http://fixture:4311", "-e", "PUBLIC_ORIGIN=http://127.0.0.1", image]);
    const port = capture("docker", ["port", id, "3000/tcp"]).split(":").at(-1);
    const origin = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetchBounded(`${origin}/healthz`)).ok) { healthy = true; break; } } catch { /* Wait for startup. */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    assert.ok(healthy, "web did not become healthy");
    run("docker", ["exec", id, "node", "-e", "const fs=require('fs'); if(process.getuid()===0||['/root/.npm','/app/.npmrc','/app/.env','/usr/local/lib/node_modules/npm'].some(p=>fs.existsSync(p))) process.exit(1)"]);
    for (const available of [true, false, true]) {
      run("docker", ["exec", id, "node", "-e", `fetch('http://fixture:4311/control/${available ? "up" : "down"}',{method:'POST'}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))`]);
      const response = await fetchBounded(`${origin}/system-status`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(available ? "synthetic-api" : "Service status is currently unavailable."));
      assert.doesNotMatch(html, /synthetic-private-error|http:\/\/fixture|API_INTERNAL_URL|ResponseError/);
      if (!available) assert.ok(!html.includes("synthetic-api"));
      const health = await fetchBounded(`${origin}/healthz`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: "ok" });
      assert.equal(health.headers.get("cache-control"), "no-store");
      const assets = [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(m => m[1]);
      assert.ok(assets.length > 0);
      for (const asset of assets) {
        const response = await fetchBounded(new URL(asset.replaceAll("&amp;", "&"), origin));
        assert.equal(response.status, 200);
        assert.doesNotMatch(await response.text(), /http:\/\/fixture:4311|API_INTERNAL_URL|synthetic-private-error/);
      }
    }
    console.log(`Image smoke passed: ${image}`);
  } finally {
    for (const name of containers.reverse()) run("docker", ["rm", "--force", name]);
    if (createdNetwork) run("docker", ["network", "rm", network]);
  }
}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Image operation failed; raw output withheld"); process.exitCode = 1; });
}
