import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function checkClient(manifest, lock) {
  const name = "@dadzhioski/professional-services-api-client";
  const version = manifest.dependencies?.[name];
  const numeric = "(?:0|[1-9][0-9]*)";
  const identifier = `(?:${numeric}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
  const exact = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
  const entry = lock.packages?.[`node_modules/${name}`];
  if (typeof version !== "string" || !exact.test(version) ||
      lock.packages?.[""]?.dependencies?.[name] !== version || entry?.version !== version ||
      entry?.link || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(entry?.integrity ?? "") ||
      !entry?.resolved?.startsWith("https://npm.pkg.github.com/")) {
    throw new Error("API client must use one exact registry version with matching lock metadata and integrity.");
  }
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`API client: ${checkClient(JSON.parse(readFileSync("package.json")), JSON.parse(readFileSync("package-lock.json")))}`);
}
