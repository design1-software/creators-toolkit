// 📘 WHAT THIS FILE DOES: Configures the Next.js build and dev server.
// 🔗 Next.js config reference: https://nextjs.org/docs/app/api-reference/config/next-config-js
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 📘 'turbopack.root' tells the dev server this project is the workspace root.
  // Without this, Next.js sees multiple package.json files and warns about ambiguity.
  turbopack: {
    root: __dirname, // '__dirname' = the absolute path of this config file's directory
  },
};

export default nextConfig;
