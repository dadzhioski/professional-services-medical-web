import { spawnSync } from "node:child_process";
// authorized_keys: restrict,command="/usr/bin/node /opt/medical-web-deploy/scripts/deploy-ssh.mjs"
if (process.env.SSH_ORIGINAL_COMMAND !== "web-release" || process.argv.length !== 2) {
  console.error("Only web-release requests are accepted");
  process.exitCode = 1;
} else {
  const result = spawnSync("/usr/bin/sudo", ["-n", "/usr/bin/env", "-i", "PATH=/usr/bin:/bin",
    "/usr/bin/node", "/opt/medical-web-deploy/scripts/deploy-host.mjs"], {
    stdio: "inherit", env: { PATH: "/usr/bin:/bin" }, timeout: 1_200_000,
  });
  process.exitCode = result.status ?? 1;
}
