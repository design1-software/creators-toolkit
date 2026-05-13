// 📘 WHAT THIS FILE DOES: Configures the Next.js build and dev server.
// 🔗 Next.js config reference: https://nextjs.org/docs/app/api-reference/config/next-config-js
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 📘 'output: standalone' tells Next.js to bundle everything the app needs to run
  // into a single .next/standalone folder — including a minimal node_modules.
  // This is the recommended way to run Next.js inside a Docker container because
  // the image becomes much smaller (no full node_modules needed at runtime).
  // 🔗 Next.js standalone output: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: "standalone",

  // 📘 'turbopack.root' tells the dev server this project is the workspace root.
  // Without this, Next.js sees multiple package.json files and warns about ambiguity.
  turbopack: {
    root: __dirname, // '__dirname' = the absolute path of this config file's directory
  },

  experimental: {
    // 📘 WHY THIS IS NEEDED: In Next.js 16, any POST request with a multipart/form-data
    // content type is treated as a "possible Server Action" and routed through the
    // Server Action body parser — which has a default limit of 1MB. Video uploads
    // far exceed that, causing a silent 400 with an empty response body.
    // Setting bodySizeLimit to '500mb' raises the cap so video uploads succeed.
    // 🔗 Server Actions bodySizeLimit: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
