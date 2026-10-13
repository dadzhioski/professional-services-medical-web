import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

// Next's standalone server needs static assets alongside its traced output.
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("error", () => { console.error("Unable to start standalone server"); process.exitCode = 1; });
server.on("exit", code => { process.exitCode = code ?? 1; });
