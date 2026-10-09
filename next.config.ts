import type { NextConfig } from "next";
import { parseServerEnvironment } from "./src/lib/config/schema";

parseServerEnvironment({ NODE_ENV: process.env.NODE_ENV });
const nextConfig: NextConfig = {};
export default nextConfig;
