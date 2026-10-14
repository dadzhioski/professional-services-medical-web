import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { validateImage } from "./production-config.mjs";
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const image = validateImage(process.env.CADDY_IMAGE ?? `professional-services-medical-edge:${revision}`);
assert.ok(image.endsWith(`:${revision}`), "Build tag must match current commit");
execFileSync("docker", ["build", "--platform", "linux/amd64", "--file", "deployment/Dockerfile.caddy", "--build-arg", `REVISION=${revision}`, "--tag", image, "."], { stdio: "inherit" });
