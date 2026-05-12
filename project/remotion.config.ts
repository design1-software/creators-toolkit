// 📘 WHAT THIS FILE DOES: Configures how Remotion renders videos.
// Remotion reads this file automatically when running the render command.
// 🔗 Remotion config reference: https://www.remotion.dev/docs/config

import { Config } from "@remotion/cli/config";

// 📘 'swiftshader' is a software-based OpenGL renderer — it doesn't need a real GPU.
// Docker containers (including Railway) have no GPU, so hardware rendering would fail.
// Swiftshader runs entirely in software, making renders work in any environment.
Config.setChromiumOpenGlRenderer("swiftshader");

// 📘 In Docker, Chromium is often run as root, which normally requires --no-sandbox.
// setChromiumMultiProcessOnLinux(false) switches Chrome to single-process mode,
// which bypasses the sandbox requirement entirely — the correct Remotion 4.x fix.
Config.setChromiumMultiProcessOnLinux(false);

// 📘 setConcurrency(1) renders one frame at a time.
// Railway's free tier has limited memory — higher concurrency causes out-of-memory crashes.
Config.setConcurrency(1);
