// Synthetic transport fixture only. Never imported into the application.
import { createServer } from "node:http";
let available = true;
const sessions = new Map();
const organizations = new Map();
const profiles = new Map();
let sequence = 0;
let identityMode = "up";
let reuseAccount = false;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.test");
  if (req.method === "POST" && url.pathname.startsWith("/control/identity/")) {
    identityMode = url.pathname.split("/").at(-1);
    if (identityMode === "reset") { sessions.clear(); organizations.clear(); profiles.clear(); reuseAccount = false; identityMode = "up"; }
    if (identityMode === "same-account") { reuseAccount = true; identityMode = "up"; }
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/profile/bump") {
    // Simulates a save from another tab or device.
    for (const profile of profiles.values()) Object.assign(profile, { displayName: "Edited elsewhere", version: profile.version + 1 });
    res.writeHead(204).end(); return;
  }
  if (url.pathname.startsWith("/api/auth/") || ["/api/v1/account", "/api/v1/me", "/api/v1/onboarding", "/api/v1/profile"].includes(url.pathname)) {
    res.setHeader("Cache-Control", "no-store");
    const session = /(?:^|; )platform-session-local=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
    const state = sessions.get(session);
    const setCookie = value => res.setHeader("Set-Cookie", `platform-session-local=${value}; Path=/; HttpOnly; SameSite=Lax${value ? "" : "; Max-Age=0"}`);
    const fail = status => { res.writeHead(status, { "Content-Type": "application/problem+json" }).end(JSON.stringify({ detail: "synthetic-private-error" })); };
    const json = body => { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body)); };
    if (identityMode === "down") { fail(503); return; }
    if (url.pathname === "/api/auth/login") {
      const destination = url.searchParams.get("returnTo");
      if (!["/mk/provider", "/en/provider", "/bg/provider", "/sq/provider"].includes(destination)) { fail(400); return; }
      // Synthetic navigation only: no Google/OIDC implementation or credentials.
      const id = `synthetic-session-${++sequence}`;
      sessions.set(id, { csrf: `synthetic-csrf-${sequence}`, account: reuseAccount ? "synthetic-account-reused" : `synthetic-account-${sequence}` });
      setCookie(id); res.writeHead(302, { Location: destination }).end(); return;
    }
    if (!state || identityMode === "expired") { fail(401); return; }
    if (identityMode === "forbidden") { fail(403); return; }
    if (url.pathname === "/api/v1/account") {
      json({ accountId: "synthetic-private-account", emailVerified: identityMode !== "unverified", sessionExpiresAt: "2099-01-01T00:00:00Z" }); return;
    }
    if (url.pathname === "/api/auth/csrf") {
      json({ token: identityMode === "bad-csrf" ? "wrong-token" : state.csrf, headerName: "X-CSRF-TOKEN" }); return;
    }
    if (["POST", "PATCH"].includes(req.method) && req.headers["x-csrf-token"] !== state.csrf) { fail(403); return; }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      sessions.delete(session); setCookie(""); res.writeHead(204).end(); return;
    }
    if (url.pathname === "/api/v1/me" && req.method === "GET") {
      if (identityMode === "context-down") { fail(503); return; }
      const organization = organizations.get(state.account);
      if (!organization) { fail(404); return; }
      json({ ...organization, suspended: identityMode === "suspended" }); return;
    }
    if (url.pathname === "/api/v1/onboarding" && req.method === "POST") {
      if (identityMode === "onboard-down") { fail(503); return; }
      // Idempotent per account, like the API: repeated calls return the same organization.
      if (!organizations.has(state.account)) {
        organizations.set(state.account, { organizationId: `synthetic-private-org-${state.account}`, approvalState: "PENDING" });
      }
      // Simulates a committed request whose response is lost in transit.
      if (identityMode === "onboard-lost") { fail(504); return; }
      json(organizations.get(state.account)); return;
    }
    if (url.pathname === "/api/v1/profile") {
      if (identityMode === "profile-down") { fail(503); return; }
      // Like the API, profile access without a workspace is a server error.
      const organization = organizations.get(state.account);
      if (!organization) { fail(500); return; }
      const key = organization.organizationId;
      if (req.method === "GET") { if (profiles.has(key)) json(profiles.get(key)); else fail(404); return; }
      if (req.method === "POST") {
        if (!profiles.has(key)) profiles.set(key, { profileId: `synthetic-private-profile-${key}`, organizationId: key,
          slug: `dr-${(++sequence).toString(16).padStart(8, "0")}`, displayName: null, biography: null, publicationState: "DRAFT", version: 0 });
        json(profiles.get(key)); return;
      }
      if (req.method === "PATCH") {
        if (identityMode === "suspended") { fail(403); return; }
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          let input;
          try { input = JSON.parse(body); } catch { fail(400); return; }
          const text = (value, max) => value === undefined || value === null || (typeof value === "string" && value.length <= max);
          if (identityMode === "profile-reject" || !Number.isInteger(input.version) || !text(input.displayName, 255) || !text(input.biography, 2000)) { fail(400); return; }
          const profile = profiles.get(key);
          if (!profile) { fail(404); return; }
          if (input.version !== profile.version) { fail(409); return; }
          // Both fields are replaced, as in the API.
          Object.assign(profile, { displayName: input.displayName ?? null, biography: input.biography ?? null, version: profile.version + 1 });
          json(profile);
        });
        return;
      }
    }
    fail(404); return;
  }
  if (req.method === "POST" && ["/control/up", "/control/down"].includes(req.url)) {
    available = req.url === "/control/up";
    res.writeHead(204).end();
    return;
  }
  if (req.url === "/healthz") { res.writeHead(200).end("ok"); return; }
  if (req.url !== "/api/v1/system/status") { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", "application/json");
  if (req.headers.authorization || req.headers.cookie) { res.writeHead(400).end(); return; }
  res.writeHead(available ? 200 : 503).end(JSON.stringify(available
    ? { service: "synthetic-api", version: "0.2.0", status: "UP" }
    : { detail: "synthetic-private-error" }));
});
server.listen(Number(process.env.FIXTURE_PORT ?? 4311), process.env.FIXTURE_HOST ?? "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
