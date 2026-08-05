import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives inside credo-mission-control's repo as an independent
  // sibling project (its own package-lock.json) - pin the workspace root
  // explicitly so Turbopack doesn't infer the parent repo's lockfile instead.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
