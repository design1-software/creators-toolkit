// 📘 WHAT THIS FILE DOES: Configures how Remotion renders videos.
// Remotion reads this file automatically when running the render command.
// The most important setting here is the Chrome flag for Docker containers.
// 🔗 Remotion config reference: https://www.remotion.dev/docs/config

import { Config } from "@remotion/cli/config";

// 📘 '--no-sandbox' is required when running Chromium inside a Docker container.
// By default, Chrome uses a security sandbox that requires kernel features
// (user namespaces) that are disabled in most container environments.
// Without this flag, Chromium refuses to start and the render fails.
// This is safe in our case because the container itself is already isolated.
// 🔗 Chrome sandbox: https://chromium.googlesource.com/chromium/src/+/main/docs/linux/sandboxing.md
Config.setChromiumOpenGlRenderer("swiftshader");
Config.setChromiumDisableWebSecurity(false);
Config.overrideWebpackConfig((config) => config);

// 📘 setConcurrency(1) limits Remotion to rendering one frame at a time.
// On a cloud server with limited memory (Railway free tier), higher concurrency
// causes out-of-memory errors. 1 is slower but reliable.
Config.setConcurrency(1);

// 📘 Pass the --no-sandbox flag to Chrome so it starts inside Docker.
Config.setChromiumFlags(["--no-sandbox", "--disable-setuid-sandbox"]);
