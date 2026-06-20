import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // `yarn dev` serves the demo shell from demo/index.html. The library build
  // below ignores this and bundles src/main.tsx directly.
  root: "demo",
  plugins: [react()],
  build: {
    // Keep the published bundle at the project-root dist/, not under demo/.
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    // Single self-contained IIFE that hosting pages load via <script src="index.min.js">.
    // React is bundled in — no external/CDN dependency on the host page.
    rollupOptions: {
      input: resolve(__dirname, "src/main.tsx"),
      output: {
        entryFileNames: "index.min.js",
        format: "iife",
        name: "MudletMapBrowser",
        // Emit the bundled stylesheet as dist/index.min.css.
        assetFileNames: (info) => {
          const name = (info as { names?: string[]; name?: string }).names?.[0] ?? (info as { name?: string }).name ?? "";
          return name.endsWith(".css") ? "index.min.css" : "assets/[name]-[hash][extname]";
        },
      },
    },
    cssCodeSplit: false,
    // Inline the 78 KB flag sprite as a base64 data-URI so the CSS is a single
    // self-contained file (no separate asset to ship). Nothing else this large
    // is referenced by the bundled CSS.
    assetsInlineLimit: 90000,
    minify: "terser",
    sourcemap: true,
  },
  server: {
    // Allow the dev server to load ../src from the demo root.
    fs: { allow: [resolve(__dirname)] },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
