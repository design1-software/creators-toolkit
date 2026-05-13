// 📘 WHAT THIS FILE DOES: Configures how Remotion renders videos in this project.
// Remotion reads this file automatically before every render command.
// These settings replace command-line flags — set once here, applied everywhere.
// 🔗 Remotion config reference: https://www.remotion.dev/docs/config

import { Config } from "@remotion/cli/config";

// 📘 'swiftshader' is a software-based OpenGL renderer.
// Cloud servers (like Railway) have no real GPU, so we must use software rendering.
// Without this, Chromium would crash trying to use hardware GPU acceleration.
// 🔗 OpenGL renderers: https://www.remotion.dev/docs/chromium-flags#--gl
Config.setChromiumOpenGlRenderer("swiftshader");

// 📘 Render one frame at a time instead of many frames in parallel.
// Railway's free tier has limited RAM — rendering multiple frames at once causes
// out-of-memory crashes. Setting concurrency to 1 keeps memory usage low.
// 🔗 Concurrency docs: https://www.remotion.dev/docs/config#setconcurrency
Config.setConcurrency(1);

// 📘 Run Chromium in single-process mode on Linux.
// In multi-process mode, Chromium forks child processes which requires OS-level
// sandboxing. Docker containers restrict this by default, so we disable it here.
// 🔗 Linux multiprocess: https://www.remotion.dev/docs/config#setchromiummultiprocessonlinux
Config.setChromiumMultiProcessOnLinux(false);
