import assert from "node:assert/strict";

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
