import assert from "node:assert/strict";

export const releaseRepository = "dadzhioski/professional-services-medical-web";
export const releaseImages = Object.freeze({
  web: "ghcr.io/dadzhioski/professional-services-medical-web",
  caddy: "ghcr.io/dadzhioski/professional-services-medical-edge",
});
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const exactKeys = (value, keys) => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

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

const second = 1_000_000_000;
// The reverse proxies in adapted (JSON) Caddy configuration, with the route matchers and body limit that lead to each.
export function edgeProxies(config) {
  const proxies = [];
  const walk = (routes, match, maxSize) => {
    for (const route of routes ?? []) {
      // Site host matchers wrap every route; only path and method matchers distinguish the proxies.
      const own = (route.match ?? []).map(m => Object.fromEntries(Object.entries(m).filter(([key]) => key !== "host")))
        .filter(m => Object.keys(m).length);
      const matched = own.length ? own : match;
      let limit = maxSize;
      for (const handler of route.handle ?? []) {
        if (handler.handler === "subroute") walk(handler.routes, matched, limit);
        if (handler.handler === "request_body") limit = handler.max_size;
        if (handler.handler === "reverse_proxy") proxies.push({ match: matched ?? [], maxSize: limit,
          dial: handler.upstreams.map(u => u.dial), transport: handler.transport });
      }
    }
  };
  for (const server of Object.values(config.apps.http.servers)) walk(server.routes);
  return proxies;
}

// Only image-upload pages may hold the web for longer, and only for a budget the web itself stays inside.
export function validateEdgeLimits(config, { locales, uploadPages, uploadBudgetMs }) {
  const proxies = edgeProxies(config);
  assert.equal(proxies.length, 3, "Expected the API, web-upload and web proxies only");
  const [api, upload, web] = proxies;
  assert.deepEqual(api.dial, ["api:8080"]);
  assert.deepEqual(api.match, [{ path: ["/api/*"] }]);
  assert.equal(api.transport.response_header_timeout, 6 * second);
  assert.equal(api.maxSize, undefined);
  assert.deepEqual(upload.dial, ["web:3000"]);
  assert.equal(upload.match.length, 1);
  assert.deepEqual(upload.match[0].method, ["POST"]);
  assert.deepEqual([...upload.match[0].path].sort(), uploadPages.flatMap(page => locales.map(l => `/${l}/provider/${page}`)).sort());
  assert.equal(upload.maxSize, 12_000_000);
  assert.equal(upload.transport.response_header_timeout, 50 * second);
  // Caddy's read deadline also covers the wait for headers.
  assert.equal(upload.transport.read_timeout, 50 * second);
  assert.equal(upload.transport.write_timeout, 30 * second);
  assert.ok(uploadBudgetMs * 1_000_000 + 5 * second <= upload.transport.response_header_timeout,
    "The web upload budget must end at least 5s before the edge gives up");
  assert.deepEqual(web.dial, ["web:3000"]);
  assert.deepEqual(web.match, []);
  assert.equal(web.maxSize, 1_000_000);
  for (const key of ["response_header_timeout", "read_timeout", "write_timeout"]) assert.equal(web.transport[key], 10 * second);
}
