import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { serviceWorker } from "./plugins/serviceWorker.ts";

// `base: "./"` keeps asset paths relative, so the built site works from any
// sub-folder (e.g. https://<user>.github.io/hikers-notebook/).
export default defineConfig({
  base: "./",
  // `serviceWorker` writes sw.js, which makes the built site work offline.
  plugins: [svelte(), serviceWorker()],
  // MapLibre's worker is located relative to its own module (see
  // src/lib/map.ts), so the library must not be moved by Vite's dev-time
  // pre-bundling.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
