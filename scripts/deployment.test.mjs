import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { validateReleaseRequest, validateReleaseManifest, validateReleaseEvidence, validateReleaseRecord,
  validateDeploymentState, validatePulledReleaseImage, releaseRepository, releaseImages } from "./production-config.mjs";
import { releaseStore, releaseTransaction, readReleaseRequest, validateDeployAuthorization } from "./integration.mjs";
import { verifyApiIdentity, verifyReleaseHttp } from "./compatibility.mjs";

const sha = "a".repeat(40);
const request = () => ({ operation: "deploy", environment: "non-production", workflowRun: "42", sha,
  config: "baseline-v1", apiImage: `example/api:${"b".repeat(40)}`, apiVersion: "0.2.0" });
const manifest = (revision = sha) => ({ schema: 1, repository: releaseRepository, sha: revision, runId: "11", attempt: 1,
  clientVersion: "0.2.0", configuration: { compose: "c".repeat(64), caddy: "d".repeat(64) },
  web: { image: `${releaseImages.web}:${revision}`, digest: `sha256:${"e".repeat(64)}`, revision, clientVersion: "0.2.0" },
  caddy: { image: `${releaseImages.caddy}:${revision}`, digest: `sha256:${"f".repeat(64)}`, revision } });
const run = () => ({ id: 11, run_attempt: 1, head_sha: sha, repository: { full_name: releaseRepository },
  head_repository: { full_name: releaseRepository }, path: ".github/workflows/ci.yml", event: "push",
  head_branch: "main", status: "completed", conclusion: "success" });
const artifact = () => ({ name: `release-${sha}-1`, expired: false, expires_at: "2099-01-01T00:00:00Z",
  digest: `sha256:${"1".repeat(64)}`, workflow_run: { id: 11, head_sha: sha } });

test("release requests reject mutable tags, paths, injected commands and extra authority", () => {
  validateReleaseRequest(request());
  for (const [key, value] of [["sha", "main"], ["sha", "a".repeat(7)], ["config", "../root"], ["config", "a\ncommand"],
    ["apiImage", "api:latest"], ["apiVersion", "v;echo secret"], ["operation", "restart-api"],
    ["environment", "custom"], ["workflowRun", "42;id"], ["compose", "/tmp/evil.yaml"]]) {
    assert.throws(() => validateReleaseRequest({ ...request(), [key]: value }));
  }
  const rollback = { operation: "rollback", environment: "production", workflowRun: "42", record: "c".repeat(32) };
  validateReleaseRequest(rollback);
  for (const record of ["../state", "latest", "c".repeat(31), "C".repeat(32)]) assert.throws(() => validateReleaseRequest({ ...rollback, record }));
  assert.throws(() => validateReleaseRequest({ ...rollback, sha }));
});

test("release manifest binds both allowed images, revision, client and configuration", () => {
  validateReleaseManifest(manifest(), sha);
  for (const change of [m => { m.web.image = `attacker/web:${sha}`; }, m => { m.web.digest = "sha256:bad"; },
    m => { m.caddy.revision = "b".repeat(40); }, m => { m.web.clientVersion = "0.3.0"; },
    m => { m.clientVersion = "^0.2.0"; }, m => { m.configuration.compose = "../compose"; },
    m => { m.repository = "attacker/repo"; }, m => { m.extra = "unchecked"; }]) {
    const value = manifest(); change(value); assert.throws(() => validateReleaseManifest(value, sha));
  }
});

test("evidence requires successful same-repository main push and matching unexpired artifact", () => {
  validateReleaseEvidence(manifest(), run(), artifact());
  for (const change of [r => { r.conclusion = "failure"; }, r => { r.status = "in_progress"; },
    r => { r.event = "pull_request"; }, r => { r.head_branch = "feature"; },
    r => { r.head_repository.full_name = "fork/repo"; }, r => { r.path = ".github/workflows/other.yml"; },
    r => { r.run_attempt = 2; }, r => { r.id = 12; }, r => { r.head_sha = "b".repeat(40); }]) {
    const value = run(); change(value); assert.throws(() => validateReleaseEvidence(manifest(), value, artifact()));
  }
  for (const change of [a => { a.expired = true; }, a => { a.expires_at = "2000-01-01"; },
    a => { a.name = "release-untrusted"; }, a => { a.workflow_run.id = 12; }, a => { a.digest = "bad"; }]) {
    const value = artifact(); change(value); assert.throws(() => validateReleaseEvidence(manifest(), run(), value));
  }
});

test("pulled images must match the verified digest, revision, client and runtime user", () => {
  const image = () => ({ Id: `sha256:${"2".repeat(64)}`, RepoDigests: [`${releaseImages.web}@${manifest().web.digest}`],
    Config: { User: "10001:10001", Labels: { "org.opencontainers.image.revision": sha, "io.professional-services.api-client.version": "0.2.0" } } });
  validatePulledReleaseImage(manifest(), "web", image());
  for (const change of [i => { i.RepoDigests = [`${releaseImages.web}@sha256:${"3".repeat(64)}`]; },
    i => { i.Config.Labels["org.opencontainers.image.revision"] = "b".repeat(40); },
    i => { i.Config.Labels["io.professional-services.api-client.version"] = "0.3.0"; }, i => { i.Config.User = "root"; }]) {
    const value = image(); change(value); assert.throws(() => validatePulledReleaseImage(manifest(), "web", value));
  }
});

test("host permits manual non-production releases without approval but retains production approval", () => {
  const value = { ...run(), id: 42, event: "workflow_dispatch", path: ".github/workflows/deploy.yml", status: "in_progress" };
  for (const operation of ["deploy", "rollback"]) {
    for (const environment of ["non-production", "production"]) {
      const input = operation === "deploy" ? { ...request(), environment }
        : { operation, environment, workflowRun: "42", record: "c".repeat(32) };
      const approved = [{ state: "approved", environments: [{ name: environment }] }];
      validateDeployAuthorization(input, value, approved);
      if (environment === "non-production") validateDeployAuthorization(input, value, []);
      else {
        assert.throws(() => validateDeployAuthorization(input, value, []));
        assert.throws(() => validateDeployAuthorization(input, value,
          [{ state: "approved", environments: [{ name: "non-production" }] }]));
      }
      const rejected = { state: "rejected", environments: [{ name: environment }] };
      for (const reviews of [[rejected], [...approved, rejected], [rejected, ...approved]]) {
        assert.throws(() => validateDeployAuthorization(input, value, reviews));
      }
      for (const change of [{ status: "completed" }, { head_branch: "feature" }, { event: "push" },
        { id: 43 }, { path: ".github/workflows/other.yml" },
        { repository: { full_name: "fork/repo" } }, { head_repository: { full_name: "fork/repo" } }]) {
        assert.throws(() => validateDeployAuthorization(input, { ...value, ...change }, approved));
        if (environment === "non-production") {
          assert.throws(() => validateDeployAuthorization(input, { ...value, ...change }, []));
        }
      }
    }
  }
  assert.throws(() => validateDeployAuthorization({ ...request(), environment: "custom" }, value, []));
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "web-release-policy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = releaseStore(root), calls = [];
  const operations = {
    evidence: async revision => manifest(revision),
    prepare: async () => calls.push("prepare"), apply: async () => calls.push("apply"), verify: async () => calls.push("verify"),
  };
  return { root, store, operations, calls };
}

test("first deploy, replacement and explicit rollback preserve successful records", async t => {
  const { store, operations, calls } = fixture(t);
  const a = await releaseTransaction(request(), store, operations);
  const b = await releaseTransaction({ ...request(), sha: "b".repeat(40) }, store, operations);
  assert.deepEqual(store.state(), { current: b.id, previous: a.id, pending: null });
  const restored = await releaseTransaction({ operation: "rollback", environment: "non-production", workflowRun: "43", record: a.id }, store, operations);
  assert.equal(restored.manifest.sha, a.manifest.sha); assert.equal(restored.restoredFrom, a.id);
  assert.equal(store.state().previous, b.id);
  assert.equal(store.record(a.id).manifest.sha, sha);
  assert.deepEqual(calls, Array(3).fill(["prepare", "apply", "verify"]).flat());
});

test("failed preflight never replaces web or creates a pending release", async t => {
  const { store, operations, calls } = fixture(t);
  operations.prepare = async () => { throw new Error("API unavailable with private data"); };
  await assert.rejects(releaseTransaction(request(), store, operations), /failed during preflight/);
  assert.deepEqual(calls, []); assert.deepEqual(store.state(), { current: null, previous: null, pending: null });
});

test("failed post-deploy check preserves previous success and requires explicit rollback", async t => {
  const { store, operations } = fixture(t);
  const a = await releaseTransaction(request(), store, operations);
  const verify = operations.verify;
  operations.verify = async () => { throw new Error("private response"); };
  await assert.rejects(releaseTransaction({ ...request(), sha: "b".repeat(40) }, store, operations), /failed during verify/);
  assert.equal(store.state().current, a.id); assert.ok(store.state().pending);
  await assert.rejects(releaseTransaction(request(), store, operations), /failed during resolve/);
  operations.verify = verify;
  const restored = await releaseTransaction({ operation: "rollback", environment: "non-production", workflowRun: "44", record: a.id }, store, operations);
  assert.equal(restored.manifest.sha, sha); assert.equal(store.state().pending, null);
});

test("missing rollback, cross-environment records, corrupt state and stale locks fail closed", async t => {
  const { root, store, operations, calls } = fixture(t);
  const rollback = { operation: "rollback", environment: "non-production", workflowRun: "44", record: "d".repeat(32) };
  await assert.rejects(releaseTransaction(rollback, store, operations)); assert.deepEqual(calls, []);
  const a = await releaseTransaction(request(), store, operations);
  await assert.rejects(releaseTransaction({ ...rollback, record: a.id, environment: "production" }, store, operations));
  assert.throws(() => store.record("../state"));
  const record = store.record(a.id); record.manifest.web.digest = "corrupt";
  assert.throws(() => validateReleaseRecord(record));
  writeFileSync(join(root, "state.json"), '{"current":"../../etc","previous":null,"pending":null}');
  await assert.rejects(releaseTransaction(request(), store, operations));
  mkdirSync(join(root, "lock"));
  await assert.rejects(releaseTransaction(request(), store, operations), /EEXIST/);
  assert.throws(() => validateDeploymentState({ current: null, previous: null, pending: null, extra: true }));
});

test("SSH wrapper rejects shell, forwarding-style commands and backend operations before sudo", () => {
  for (const command of [undefined, "", "bash", "docker compose restart api", "web-release; id", "web-release\ncat /etc/shadow"]) {
    const result = spawnSync(process.execPath, ["scripts/deploy-ssh.mjs"], { encoding: "utf8",
      env: { ...process.env, SSH_ORIGINAL_COMMAND: command ?? "" } });
    assert.equal(result.status, 1); assert.match(result.stderr, /Only web-release/);
    assert.doesNotMatch(result.stderr, /sudo|shadow/);
  }
});

test("request input has a size bound and rejects malformed JSON", async () => {
  assert.deepEqual(await readReleaseRequest(Readable.from([JSON.stringify(request())])), request());
  await assert.rejects(readReleaseRequest(Readable.from(["x".repeat(4097)])));
  await assert.rejects(readReleaseRequest(Readable.from(["{broken"])));
});

test("API identity requires the selected running image and real api alias", () => {
  const value = { Config: { Image: request().apiImage, Labels: {} }, Image: "sha256:id", State: { Running: true },
    NetworkSettings: { Networks: { edge: { Aliases: ["api"] } } } };
  const digest = `@sha256:${"c".repeat(64)}`;
  const selected = { Id: "sha256:id", RepoDigests: [`example/api${digest}`] };
  verifyApiIdentity(value, request().apiImage, selected, "edge");
  value.Config.Image = `${request().apiImage}${digest}`;
  verifyApiIdentity(value, request().apiImage, selected, "edge");
  for (const image of [`${request().apiImage}@sha256:${"d".repeat(64)}`, `${request().apiImage}@sha256:short`,
    `${request().apiImage}0`, `other/api:${"b".repeat(40)}${digest}`]) {
    value.Config.Image = image;
    assert.throws(() => verifyApiIdentity(value, request().apiImage, selected, "edge"));
  }
  value.Config.Image = request().apiImage;
  assert.throws(() => verifyApiIdentity(value, request().apiImage, { ...selected, Id: "sha256:other" }, "edge"));
  value.Config.Labels["io.professional-services.web-smoke"] = "fixture";
  assert.throws(() => verifyApiIdentity(value, request().apiImage, selected, "edge"));
});

test("HTTP verification checks raw SSR, metadata, headers and API version", async t => {
  let failure = "";
  const html = '<title>Medical web</title><meta name="description" content="Foundation"><meta name="robots" content="noindex, nofollow"><main><dl>0.2.0</dl></main>';
  const server = createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (failure === "headers") res.setHeader("Server", "private");
    if (req.url === "/healthz") { res.setHeader("Cache-Control", "no-store"); res.end('{"status":"ok"}'); }
    else if (req.url === "/api/v1/system/status") res.end(JSON.stringify({ service: "synthetic", version: failure === "api" ? "wrong" : "0.2.0", status: "UP" }));
    else res.end(failure === "ssr" ? html.replace("<dl>0.2.0</dl>", "Unavailable") : failure === "metadata" ? html.replace("noindex", "index") : html);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  await verifyReleaseHttp(url, "0.2.0");
  for (failure of ["headers", "api", "ssr", "metadata"]) await assert.rejects(verifyReleaseHttp(url, "0.2.0"));
  await assert.rejects(verifyReleaseHttp(url, "0.2.0", Date.now() - 1));
});

test("failure journals contain stage identifiers without raw exceptions", async t => {
  const { root, store, operations } = fixture(t);
  operations.apply = async () => { throw new Error("secret-token synthetic@example.test"); };
  await assert.rejects(releaseTransaction(request(), store, operations));
  const journal = readFileSync(join(root, `${store.state().pending}.json`), "utf8");
  assert.match(journal, /apply/); assert.doesNotMatch(journal, /secret-token|synthetic@example/);
});
