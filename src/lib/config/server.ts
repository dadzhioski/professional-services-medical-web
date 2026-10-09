import "server-only";
import { parseServerEnvironment } from "./schema";

export function getServerEnvironment() {
  return parseServerEnvironment({
    NODE_ENV: process.env.NODE_ENV,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  });
}
