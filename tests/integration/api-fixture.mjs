// Synthetic transport only: control plane is container-loopback, never proxied.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
let mode = "up";
// Upload timing for edge timeout checks: answer at once, after 20 s, or never.
let media = "media-fast";
let lastRequest;
// One synthetic signed-in provider with a profile draft, enough to drive a photo upload through the edge.
const session = /(?:^|; )platform-session-local=(synthetic-session-[a-z]+)(?:;|$)/;
const profile = { profileId: "synthetic-private-profile", organizationId: "synthetic-private-org", slug: "dr-0000edge",
  displayName: "Dr. Synthetic Edge", biography: null, publicationState: "DRAFT", photoMediaId: null, version: 0 };
const images = new Map();
// A 1x1 transparent PNG.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const json = (res, status, body) => res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
  .end(JSON.stringify(body));
function provider(req, res, path) {
  if (!session.test(req.headers.cookie ?? "")) return json(res, 401, { detail: "synthetic-private-error" });
  if (path === "/api/v1/account") return json(res, 200, { accountId: "synthetic-private-account", emailVerified: true, sessionExpiresAt: "2099-01-01T00:00:00Z" });
  if (path === "/api/v1/me") return json(res, 200, { organizationId: "synthetic-private-org", approvalState: "PENDING", approvalRevision: 1, suspended: false });
  if (path === "/api/auth/csrf") return json(res, 200, { token: "synthetic-csrf-edge", headerName: "X-CSRF-TOKEN" });
  if (path === "/api/v1/profile" && req.method === "GET") return json(res, 200, profile);
  if (req.method !== "GET" && req.headers["x-csrf-token"] !== "synthetic-csrf-edge") return json(res, 403, { detail: "synthetic-private-error" });
  if (path === "/api/v1/media" && req.method === "POST") {
    req.resume();
    req.on("end", () => {
      if (media === "media-stall") return;
      const mediaId = randomUUID();
      images.set(mediaId, png);
      setTimeout(() => json(res, 201, { mediaId, purpose: "PROFILE_PHOTO", state: "READY", attached: false }), media === "media-slow" ? 20_000 : 0);
    });
    return;
  }
  if (path === "/api/v1/profile/photo" && req.method === "PUT") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      const input = JSON.parse(body);
      if (input.version !== profile.version) return json(res, 409, { detail: "synthetic-private-error" });
      if (!images.has(input.mediaId)) return json(res, 422, { detail: "synthetic-private-error" });
      Object.assign(profile, { photoMediaId: input.mediaId, version: profile.version + 1 });
      json(res, 200, profile);
    });
    return;
  }
  const image = /^\/api\/v1\/media\/([0-9a-f-]{36})(\/content)?$/.exec(path);
  if (image && image[2] && req.method === "GET" && images.has(image[1])) {
    return res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }).end(images.get(image[1]));
  }
  if (image && !image[2] && req.method === "DELETE") { images.delete(image[1]); return res.writeHead(204).end(); }
  res.writeHead(404).end();
}
const api = createServer((req, res) => {
  lastRequest = { path: req.url, forwardedFor: req.headers["x-forwarded-for"], forwardedProto: req.headers["x-forwarded-proto"] };
  if (mode === "stall") return;
  const path = new URL(req.url, "http://fixture").pathname;
  if (path !== "/api/v1/system/status") return provider(req, res, path);
  res.setHeader("Content-Type", "application/json");
  res.writeHead(mode === "up" ? 200 : 503).end(JSON.stringify(mode === "up"
    ? { service: "synthetic-api", version: "0.2.0", status: "UP" }
    : { detail: "synthetic-private-error" }));
});
api.listen(8080, "0.0.0.0");
const control = createServer((req, res) => {
  const next = req.url.slice(1);
  if (req.method === "POST" && ["media-fast", "media-slow", "media-stall"].includes(next)) {
    media = next;
    res.writeHead(204).end();
  } else if (req.method === "POST" && ["up", "down", "stall", "refused"].includes(next)) {
    if (next === "refused") { api.closeAllConnections(); api.close(); }
    else if (mode === "refused") api.listen(8080, "0.0.0.0");
    mode = next;
    if (next === "up") media = "media-fast";
    res.writeHead(204).end();
  } else if (req.url === "/last-request") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(lastRequest ?? {}));
  } else res.writeHead(404).end();
});
control.listen(8081, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  api.closeAllConnections(); api.close(); control.close(() => process.exit(0));
});
