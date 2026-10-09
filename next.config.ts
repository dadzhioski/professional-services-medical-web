import type { NextConfig } from "next";
import { parseServerEnvironment } from "./src/lib/config/schema";

parseServerEnvironment({
  NODE_ENV: process.env.NODE_ENV,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
});
const nextConfig: NextConfig = {};
export default nextConfig;
