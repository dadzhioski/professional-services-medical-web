import "server-only";
import { parseServerEnvironment } from "./schema";

export function getServerEnvironment() {
  return parseServerEnvironment({ NODE_ENV: process.env.NODE_ENV });
}
