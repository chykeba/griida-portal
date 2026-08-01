import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next guess the wrong workspace
  // root. Pin it to this app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
