// Install this complete scripts tree root-owned; never upload it from a workflow.
process.chdir("/opt/medical-web-deploy");
try {
  const { deployHost } = await import("./integration.mjs");
  await deployHost();
} catch {
  console.error("Web release rejected or failed; administrator must inspect the sanitized host release journal");
  process.exitCode = 1;
}
