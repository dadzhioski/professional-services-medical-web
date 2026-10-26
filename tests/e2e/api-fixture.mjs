// Synthetic transport fixture only. Never imported into the application.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
let available = true;
const sessions = new Map();
const organizations = new Map();
const profiles = new Map();
// mediaId -> { organizationId, purpose, bytes, contentType, attached }
const media = new Map();
// organizationId -> credentials
const credentials = new Map();
// A 1x1 transparent PNG.
const syntheticPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Content is detected from the bytes, as in the API; a missing end marker stands in for a corrupt image.
function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(pngSignature)) return bytes.includes(Buffer.from("IEND")) ? "image/png" : "corrupt";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9 ? "image/jpeg" : "corrupt";
  return null;
}
function readBody(req, done) {
  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => done(Buffer.concat(chunks)));
}
function readJson(req, res, fail, done) {
  if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") { fail(415); return; }
  readBody(req, body => {
    let input;
    try { input = JSON.parse(body.toString()); } catch { fail(400); return; }
    if (!input || typeof input !== "object") { fail(400); return; }
    done(input);
  });
}
// The bytes of the multipart part named "file".
function filePart(body, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/.exec(contentType ?? "");
  if (!boundary) return null;
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let start = body.indexOf(marker);
  while (start !== -1) {
    const headerEnd = body.indexOf("\r\n\r\n", start);
    const next = headerEnd === -1 ? -1 : body.indexOf(marker, headerEnd);
    if (next === -1) return null;
    if (/name="file"/.test(body.subarray(start, headerEnd).toString())) return body.subarray(headerEnd + 4, next - 2);
    start = next;
  }
  return null;
}
const services = new Map();
const locations = new Map();
const medical = new Map();
const catalogPaths = /^\/api\/v1\/(?:services|locations)(?:\/[^/]+)?$|^\/api\/v1\/medical$|^\/api\/v1\/reference\/(?:specialties|countries|cities)$/;
// Small synthetic reference dataset with stable IDs; Albanian labels are absent, as in the 0.3.0 contract.
const cityIds = { skopje: "0a6b1c2d-0000-4000-8000-000000000001", bitola: "0a6b1c2d-0000-4000-8000-000000000002", sofia: "0a6b1c2d-0000-4000-8000-000000000003" };
const reference = {
  specialties: [
    { id: "5b0c1d2e-0000-4000-8000-000000000001", code: "cardiology", labels: { mk: "Кардиологија", en: "Cardiology", bg: "Кардиология" } },
    { id: "5b0c1d2e-0000-4000-8000-000000000002", code: "dermatology", labels: { mk: "Дерматологија", en: "Dermatology", bg: "Дерматология" } },
  ],
  countries: [{ code: "MK", labels: { mk: "Северна Македонија", en: "North Macedonia", bg: "Северна Македония" } },
    { code: "BG", labels: { mk: "Бугарија", en: "Bulgaria", bg: "България" } }],
  cities: [
    { id: cityIds.skopje, code: "skopje", countryCode: "MK", labels: { mk: "Скопје", en: "Skopje", bg: "Скопие" } },
    { id: cityIds.bitola, code: "bitola", countryCode: "MK", labels: { mk: "Битола", en: "Bitola", bg: "Битоля" } },
    { id: cityIds.sofia, code: "sofia", countryCode: "BG", labels: { mk: "Софија", en: "Sofia", bg: "София" } },
  ],
};
const amountPattern = /^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/;
const text = (value, max, required = false) => value === undefined || value === null
  ? !required : typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
const withoutOrganization = record => { const copy = { ...record }; delete copy.organizationId; return copy; };

// Owner CRUD for services, practice locations and the medical extension, scoped to the session's organization.
function catalog(req, res, url, organization, fail, json) {
  if (identityMode === "catalog-down") { fail(503); return; }
  // Like the other owner endpoints, access without a workspace is a server error.
  if (!organization) { fail(500); return; }
  const owner = organization.organizationId;
  const [, , , kind, id] = url.pathname.split("/");
  const owned = store => [...store.values()].filter(record => record.organizationId === owner);
  const profile = profiles.get(owner);
  const body = handler => {
    if (identityMode === "suspended") { fail(403); return; }
    if (identityMode === "catalog-reject") { fail(400); return; }
    if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") { fail(415); return; }
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      let input;
      try { input = JSON.parse(raw); } catch { fail(400); return; }
      handler(input);
    });
  };
  if (kind === "medical") {
    if (req.method === "GET") { if (medical.has(owner)) json(withoutOrganization(medical.get(owner))); else fail(404); return; }
    if (req.method === "POST") {
      if (!medical.has(owner)) medical.set(owner, { medicalProfileId: randomUUID(), organizationId: owner, version: 0 });
      json(withoutOrganization(medical.get(owner))); return;
    }
    if (req.method === "PATCH") {
      body(input => {
        const current = medical.get(owner);
        if (!current) { fail(404); return; }
        if (!Number.isInteger(input.version) || (input.specialtyId != null && !reference.specialties.some(s => s.id === input.specialtyId))) { fail(400); return; }
        if (input.version !== current.version) { fail(409); return; }
        // All three fields are replaced, as in the API.
        Object.assign(current, { licenseNumber: input.licenseNumber ?? null, registrationBody: input.registrationBody ?? null,
          specialtyId: input.specialtyId ?? null, version: current.version + 1 });
        json(withoutOrganization(current));
      });
      return;
    }
    fail(405); return;
  }
  const store = kind === "services" ? services : locations;
  const key = kind === "services" ? "serviceId" : "locationId";
  const record = id && store.get(id)?.organizationId === owner ? store.get(id) : undefined;
  const validService = input => text(input.name, 120, true) && text(input.description, 1000) &&
    (input.price == null || (amountPattern.test(input.price.amount) && ["EUR", "MKD"].includes(input.price.currency))) &&
    (input.locationIds == null || (Array.isArray(input.locationIds) && input.locationIds.length <= 10 &&
      input.locationIds.every(locationId => locations.get(locationId)?.organizationId === owner)));
  const validLocation = input => text(input.label, 120) && text(input.displayAddress, 255, true) &&
    reference.cities.some(city => city.id === input.cityId && city.countryCode === input.countryCode);
  const valid = kind === "services" ? validService : validLocation;
  const fields = input => kind === "services"
    ? { name: input.name, description: input.description ?? null, locationIds: input.locationIds ?? [],
      // Responses always use two fraction digits.
      price: input.price ? { amount: Number(input.price.amount).toFixed(2), currency: input.price.currency } : null }
    : { label: input.label ?? null, displayAddress: input.displayAddress, countryCode: input.countryCode, cityId: input.cityId };
  if (!id && req.method === "GET") { json(owned(store).map(withoutOrganization)); return; }
  if (!id && req.method === "POST") {
    body(input => {
      if (!valid(input) || owned(store).length >= (kind === "services" ? 50 : 10)) { fail(400); return; }
      const created = { [key]: randomUUID(), organizationId: owner, ...fields(input), version: 0 };
      store.set(created[key], created);
      json(withoutOrganization(created));
    });
    return;
  }
  if (!record) { fail(404); return; }
  if (req.method === "GET") { json(withoutOrganization(record)); return; }
  if (req.method === "PUT") {
    body(input => {
      if (!valid(input) || !Number.isInteger(input.version)) { fail(400); return; }
      if (input.version !== record.version) { fail(409); return; }
      Object.assign(record, fields(input), { version: record.version + 1 });
      json(withoutOrganization(record));
    });
    return;
  }
  if (req.method === "DELETE") {
    if (identityMode === "suspended") { fail(403); return; }
    if (identityMode === "delete-fail") { fail(500); return; }
    store.delete(id);
    // Deleting a location unlinks it from services in the same step.
    if (kind === "locations") for (const service of owned(services)) service.locationIds = service.locationIds.filter(locationId => locationId !== id);
    // Removing the last service or location makes a published profile incomplete; the API unpublishes it.
    if (profile?.publicationState === "PUBLISHED" && owned(store).length === 0) profile.publicationState = "UNPUBLISHED";
    res.writeHead(204).end(); return;
  }
  fail(405);
}
let sequence = 0;
let identityMode = "up";
let reuseAccount = false;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.test");
  if (req.method === "POST" && url.pathname.startsWith("/control/identity/")) {
    identityMode = url.pathname.split("/").at(-1);
    if (identityMode === "reset") {
      sessions.clear(); organizations.clear(); profiles.clear(); services.clear(); locations.clear(); medical.clear();
      media.clear(); credentials.clear(); reuseAccount = false; identityMode = "up";
    }
    if (identityMode === "same-account") { reuseAccount = true; identityMode = "up"; }
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/profile/bump") {
    // Simulates a save from another tab or device.
    for (const profile of profiles.values()) Object.assign(profile, { displayName: "Edited elsewhere", version: profile.version + 1 });
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/credentials/seed") {
    // Seeds one approved credential per workspace, for evidence checks that do not go through review.
    for (const { organizationId } of organizations.values()) {
      if (!credentials.has(organizationId)) credentials.set(organizationId, [{ credentialId: randomUUID(), version: 0, revision: 1,
        state: "APPROVED", type: "LICENSE", title: "Synthetic licence", issuer: "Synthetic medical board", issuedOn: "2020-01-15",
        expiresOn: null, evidenceMediaIds: [] }]);
    }
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/credentials/review") {
    // Simulates an administrator decision on every submitted credential; the reviewer is never exposed.
    const reason = url.searchParams.get("reject");
    for (const list of credentials.values()) for (const credential of list) {
      if (credential.state === "SUBMITTED") Object.assign(credential, reason ? { state: "REJECTED", rejectionReason: reason } :
        { state: "APPROVED" }, { version: credential.version + 1 });
    }
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/credentials/bump") {
    for (const list of credentials.values()) for (const credential of list) credential.version += 1;
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/media/foreign") {
    // Evidence owned by another organization, for cross-tenant denial checks.
    const mediaId = randomUUID();
    media.set(mediaId, { organizationId: "synthetic-private-org-foreign", purpose: "CREDENTIAL_EVIDENCE", bytes: syntheticPng,
      contentType: "image/png", attached: true });
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ mediaId })); return;
  }
  if (req.method === "POST" && url.pathname === "/control/media/cleanup") {
    // The API's cleanup of released and unreferenced images, run on demand.
    for (const [id, item] of media) if (!item.attached) media.delete(id);
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/catalog/bump") {
    // Simulates service and location saves from another tab or device.
    for (const record of [...services.values(), ...locations.values()]) Object.assign(record, record.serviceId
      ? { name: "Edited elsewhere", version: record.version + 1 } : { label: "Edited elsewhere", version: record.version + 1 });
    res.writeHead(204).end(); return;
  }
  if (req.method === "POST" && url.pathname === "/control/catalog/foreign") {
    // A valid location identifier owned by another organization.
    const location = { locationId: randomUUID(), organizationId: "synthetic-private-org-foreign", label: "Foreign clinic",
      displayAddress: "Foreign street", countryCode: "MK", cityId: cityIds.skopje, version: 0 };
    locations.set(location.locationId, location);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ locationId: location.locationId })); return;
  }
  if (req.method === "POST" && url.pathname === "/control/profile/publish") {
    for (const profile of profiles.values()) profile.publicationState = "PUBLISHED";
    res.writeHead(204).end(); return;
  }
  if (url.pathname.startsWith("/api/auth/") || ["/api/v1/account", "/api/v1/me", "/api/v1/onboarding", "/api/v1/profile",
    "/api/v1/profile/photo"].includes(url.pathname) || catalogPaths.test(url.pathname) || /^\/api\/v1\/(media|credentials)(\/|$)/.test(url.pathname)) {
    res.setHeader("Cache-Control", "no-store");
    const session = /(?:^|; )platform-session-local=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
    const state = sessions.get(session);
    const setCookie = value => res.setHeader("Set-Cookie", `platform-session-local=${value}; Path=/; HttpOnly; SameSite=Lax${value ? "" : "; Max-Age=0"}`);
    const fail = status => { res.writeHead(status, { "Content-Type": "application/problem+json" }).end(JSON.stringify({ detail: "synthetic-private-error" })); };
    const json = body => { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body)); };
    if (identityMode === "down") { fail(503); return; }
    if (url.pathname.startsWith("/api/v1/reference/")) {
      // Anonymous reference data, like the API; sessions and CSRF are never required.
      if (identityMode === "catalog-down" || req.headers.cookie) { fail(identityMode === "catalog-down" ? 503 : 400); return; }
      json(reference[url.pathname.split("/").at(-1)]); return;
    }
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
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method) && req.headers["x-csrf-token"] !== state.csrf) { fail(403); return; }
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
        organizations.set(state.account, { organizationId: `synthetic-private-org-${state.account}`, approvalState: "PENDING", approvalRevision: 1 });
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
          slug: `dr-${(++sequence).toString(16).padStart(8, "0")}`, displayName: null, biography: null, publicationState: "DRAFT", photoMediaId: null, version: 0 });
        json(profiles.get(key)); return;
      }
      if (req.method === "PATCH") {
        if (identityMode === "suspended") { fail(403); return; }
        // Like the API's @RequestBody handling, only JSON bodies are accepted.
        if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") { fail(415); return; }
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
    if (catalogPaths.test(url.pathname)) { catalog(req, res, url, organizations.get(state.account), fail, json); return; }
    const organization = organizations.get(state.account);
    if (!organization) { fail(500); return; }
    const key = organization.organizationId;
    const mutating = req.method !== "GET";
    if (mutating && identityMode === "suspended") { fail(403); return; }
    const mediaMatch = /^\/api\/v1\/media\/([^/]+)(\/content)?$/.exec(url.pathname);
    if (url.pathname === "/api/v1/media" && req.method === "POST") {
      if (identityMode === "upload-reset") { req.socket.destroy(); return; }
      const purpose = url.searchParams.get("purpose");
      if (!["PROFILE_PHOTO", "CREDENTIAL_EVIDENCE"].includes(purpose)) { fail(400); return; }
      readBody(req, body => {
        if (body.length > 11 * 1024 * 1024) { fail(413); return; }
        const bytes = filePart(body, req.headers["content-type"]);
        if (!bytes) { fail(400); return; }
        if (bytes.length > 10 * 1024 * 1024) { fail(413); return; }
        const contentType = imageType(bytes);
        if (!contentType) { fail(415); return; }
        if (contentType === "corrupt") { fail(422); return; }
        if (identityMode === "media-busy") { fail(429); return; }
        const mediaId = randomUUID();
        media.set(mediaId, { organizationId: key, purpose, bytes, contentType, attached: false });
        res.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify({ mediaId, purpose, state: "READY",
          contentType, byteSize: bytes.length, width: 1, height: 1, attached: false, createdAt: new Date().toISOString() }));
      });
      return;
    }
    if (mediaMatch) {
      // Other organizations' images are indistinguishable from missing ones.
      const item = media.get(mediaMatch[1]);
      if (!item || item.organizationId !== key) { fail(404); return; }
      if (mediaMatch[2] && req.method === "GET") {
        res.writeHead(200, { "Content-Type": item.contentType, "X-Content-Type-Options": "nosniff" }).end(item.bytes); return;
      }
      if (!mediaMatch[2] && req.method === "DELETE") {
        if (item.attached) { fail(409); return; }
        media.delete(mediaMatch[1]); res.writeHead(204).end(); return;
      }
      fail(405); return;
    }
    // Attaching takes an unattached, ready image of the given purpose from the caller's organization.
    const usable = (mediaId, purpose) => {
      const item = media.get(mediaId);
      return item && item.organizationId === key && item.purpose === purpose && !item.attached && identityMode !== "media-reject";
    };
    const release = mediaId => { const item = media.get(mediaId); if (item) item.attached = false; };
    if (url.pathname === "/api/v1/profile/photo") {
      const profile = profiles.get(key);
      if (!profile) { fail(404); return; }
      if (req.method === "DELETE") {
        const version = Number(url.searchParams.get("version"));
        if (!/^\d+$/.test(url.searchParams.get("version") ?? "")) { fail(400); return; }
        if (version !== profile.version) { fail(409); return; }
        if (profile.photoMediaId) { release(profile.photoMediaId); Object.assign(profile, { photoMediaId: null, version: profile.version + 1 }); }
        json(profile); return;
      }
      if (req.method === "PUT") {
        readJson(req, res, fail, input => {
          if (typeof input.mediaId !== "string" || !Number.isInteger(input.version)) { fail(400); return; }
          if (input.version !== profile.version) { fail(409); return; }
          if (input.mediaId === profile.photoMediaId) { json(profile); return; }
          if (!usable(input.mediaId, "PROFILE_PHOTO")) { fail(422); return; }
          if (profile.photoMediaId) release(profile.photoMediaId);
          media.get(input.mediaId).attached = true;
          Object.assign(profile, { photoMediaId: input.mediaId, version: profile.version + 1 });
          json(profile);
        });
        return;
      }
    }
    const owned = credentials.get(key) ?? [];
    // Bounds and date rules from the credential contract.
    const invalidCredential = input => {
      const evidence = input.evidenceMediaIds ?? [];
      const text = value => typeof value === "string" && value.trim() && value.length <= 200;
      const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
      return !["EDUCATION", "SPECIALIZATION", "LICENSE", "CERTIFICATION", "OTHER"].includes(input.type) || !text(input.title) ||
        !text(input.issuer) || !date(input.issuedOn) || input.issuedOn > new Date().toISOString().slice(0, 10) ||
        (input.expiresOn != null && (!date(input.expiresOn) || input.expiresOn < input.issuedOn)) ||
        !Array.isArray(evidence) || evidence.length > 5 || new Set(evidence).size !== evidence.length;
    };
    // Losing the last approved credential makes a published profile incomplete, as in the API.
    const enforceCompleteness = () => {
      const profile = profiles.get(key);
      if (profile?.publicationState === "PUBLISHED" && !owned.some(item => item.state === "APPROVED")) profile.publicationState = "UNPUBLISHED";
    };
    if (url.pathname === "/api/v1/credentials" && req.method === "GET") { json(owned); return; }
    if (url.pathname === "/api/v1/credentials" && req.method === "POST") {
      readJson(req, res, fail, input => {
        const evidence = input.evidenceMediaIds ?? [];
        if (invalidCredential(input) || owned.length >= 20) { fail(400); return; }
        if (!evidence.every(id => usable(id, "CREDENTIAL_EVIDENCE"))) { fail(422); return; }
        for (const id of evidence) media.get(id).attached = true;
        const credential = { credentialId: randomUUID(), version: 0, revision: 1, state: "DRAFT", type: input.type, title: input.title,
          issuer: input.issuer, issuedOn: input.issuedOn, expiresOn: input.expiresOn ?? null, evidenceMediaIds: evidence };
        credentials.set(key, [...owned, credential]);
        res.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(credential));
      });
      return;
    }
    const credentialMatch = /^\/api\/v1\/credentials\/([^/]+)(\/submit)?$/.exec(url.pathname);
    if (credentialMatch) {
      const credential = owned.find(item => item.credentialId === credentialMatch[1]);
      if (!credential) { fail(404); return; }
      if (credentialMatch[2]) {
        if (req.method !== "POST") { fail(405); return; }
        readJson(req, res, fail, input => {
          if (!Number.isInteger(input.version)) { fail(400); return; }
          if (input.version !== credential.version || !["DRAFT", "REJECTED"].includes(credential.state)) { fail(409); return; }
          if (!credential.evidenceMediaIds.length) { fail(422); return; }
          Object.assign(credential, { state: "SUBMITTED", rejectionReason: undefined, version: credential.version + 1 });
          json(credential);
        });
        return;
      }
      if (req.method === "GET") { json(credential); return; }
      if (req.method === "DELETE") {
        if (!/^\d+$/.test(url.searchParams.get("version") ?? "")) { fail(400); return; }
        if (Number(url.searchParams.get("version")) !== credential.version) { fail(409); return; }
        for (const id of credential.evidenceMediaIds) media.delete(id);
        owned.splice(owned.indexOf(credential), 1);
        enforceCompleteness();
        res.writeHead(204).end(); return;
      }
      if (req.method === "PUT") {
        readJson(req, res, fail, input => {
          const evidence = input.evidenceMediaIds ?? [];
          if (!Number.isInteger(input.version) || invalidCredential(input)) { fail(400); return; }
          if (input.version !== credential.version) { fail(409); return; }
          const fields = { type: input.type, title: input.title, issuer: input.issuer, issuedOn: input.issuedOn,
            expiresOn: input.expiresOn ?? null, evidenceMediaIds: evidence };
          // Re-sending the current values returns the credential unchanged.
          if (JSON.stringify(fields) === JSON.stringify({ type: credential.type, title: credential.title, issuer: credential.issuer,
            issuedOn: credential.issuedOn, expiresOn: credential.expiresOn, evidenceMediaIds: credential.evidenceMediaIds })) {
            json(credential); return;
          }
          const added = evidence.filter(id => !credential.evidenceMediaIds.includes(id));
          if (!added.every(id => usable(id, "CREDENTIAL_EVIDENCE"))) { fail(422); return; }
          // Removed evidence is deleted, as in the API.
          for (const id of credential.evidenceMediaIds) if (!evidence.includes(id)) media.delete(id);
          for (const id of added) media.get(id).attached = true;
          // Any change starts a new draft revision and clears the previous review.
          Object.assign(credential, { ...fields, state: "DRAFT", rejectionReason: undefined, revision: credential.revision + 1,
            version: credential.version + 1 });
          enforceCompleteness();
          json(credential);
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
