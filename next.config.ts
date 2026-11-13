import type { NextConfig } from "next";
import { parseServerEnvironment } from "./src/lib/config/schema";

parseServerEnvironment({
  NODE_ENV: process.env.NODE_ENV,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN,
});
// Image uploads go through Server Actions: 10 MiB per image plus multipart overhead (the API allows 11 MiB per request).
const nextConfig: NextConfig = { output: "standalone", experimental: { serverActions: { bodySizeLimit: "11mb" } } };
export default nextConfig;
