import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReleaseManifest, releaseRepository, releaseImages } from "./production-config.mjs";
import { verifyApiIdentity } from "./compatibility.mjs";

const sha = "a".repeat(40);
const apiImage = `example/api:${"b".repeat(40)}`;
const manifest = (revision = sha) => ({ schema: 1, repository: releaseRepository, sha: revision, runId: "11", attempt: 1,
  clientVersion: "0.2.0", configuration: { compose: "c".repeat(64), caddy: "d".repeat(64) },
  web: { image: `${releaseImages.web}:${revision}`, digest: `sha256:${"e".repeat(64)}`, revision, clientVersion: "0.2.0" },
  caddy: { image: `${releaseImages.caddy}:${revision}`, digest: `sha256:${"f".repeat(64)}`, revision } });

test("release manifest binds both allowed images, revision, client and configuration", () => {
  validateReleaseManifest(manifest(), sha);
  for (const change of [m => { m.web.image = `attacker/web:${sha}`; }, m => { m.web.digest = "sha256:bad"; },
    m => { m.caddy.revision = "b".repeat(40); }, m => { m.web.clientVersion = "0.3.0"; },
    m => { m.clientVersion = "^0.2.0"; }, m => { m.configuration.compose = "../compose"; },
    m => { m.repository = "attacker/repo"; }, m => { m.extra = "unchecked"; }]) {
    const value = manifest(); change(value); assert.throws(() => validateReleaseManifest(value, sha));
  }
});

test("API identity requires the selected running image and real api alias", () => {
  const value = { Config: { Image: apiImage, Labels: {} }, Image: "sha256:id", State: { Running: true },
    NetworkSettings: { Networks: { edge: { Aliases: ["api"] } } } };
  const digest = `@sha256:${"c".repeat(64)}`;
  const selected = { Id: "sha256:id", RepoDigests: [`example/api${digest}`] };
  verifyApiIdentity(value, apiImage, selected, "edge");
  value.Config.Image = `${apiImage}${digest}`;
  verifyApiIdentity(value, apiImage, selected, "edge");
  for (const image of [`${apiImage}@sha256:${"d".repeat(64)}`, `${apiImage}@sha256:short`,
    `${apiImage}0`, `other/api:${"b".repeat(40)}${digest}`]) {
    value.Config.Image = image;
    assert.throws(() => verifyApiIdentity(value, apiImage, selected, "edge"));
  }
  value.Config.Image = apiImage;
  assert.throws(() => verifyApiIdentity(value, apiImage, { ...selected, Id: "sha256:other" }, "edge"));
  value.Config.Labels["io.professional-services.web-smoke"] = "fixture";
  assert.throws(() => verifyApiIdentity(value, apiImage, selected, "edge"));
});
