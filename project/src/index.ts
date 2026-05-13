// 📘 WHAT THIS FILE DOES: The entry point for the Remotion project.
// 'registerRoot' tells Remotion's CLI which React component contains all the
// compositions. Every Remotion project needs exactly one registerRoot() call.
// The CLI looks for this file when you run 'npx remotion render src/index.ts ...'
// 🔗 registerRoot: https://www.remotion.dev/docs/register-root

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

// 📘 registerRoot() connects our React component tree to the Remotion CLI.
// Without this call, the CLI has no way to discover the available compositions
// and will exit with "No entry point specified."
registerRoot(RemotionRoot);
