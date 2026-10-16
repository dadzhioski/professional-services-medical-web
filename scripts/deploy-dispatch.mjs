import { dispatchRelease } from "./integration.mjs";
try {
  await dispatchRelease();
} catch {
  console.error("Web deployment failed; check release evidence, environment authorization, and the sanitized host journal. No automatic rollback was attempted.");
  process.exitCode = 1;
}
