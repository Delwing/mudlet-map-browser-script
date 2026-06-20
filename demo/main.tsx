// Dev/demo entry shim. The demo lives in its own Vite root (this directory), so
// it can't reference ../src directly from a <script src> tag — but a JS import
// can escape the root (allowed via server.fs in vite.config). This just boots the
// real app entry.
import "../src/main";
