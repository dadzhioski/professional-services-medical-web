import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const sources = (dir: string): string[] => readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? sources(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);

test("public profile and canonical modules are server-only", () => {
  for (const path of ["src/lib/api/public-profile.ts", "src/lib/seo/canonical.ts"]) {
    expect(read(path).startsWith('import "server-only";')).toBe(true);
  }
});
test("no client component reaches the anonymous wrapper, canonical origin or server configuration", () => {
  const clients = sources("src").filter(path => /^["']use client["']/.test(read(path)));
  expect(clients.length).toBeGreaterThan(0);
  for (const path of clients) {
    expect(read(path), path).not.toMatch(/@\/lib\/(api\/|seo\/canonical|config\/server)/);
  }
});
