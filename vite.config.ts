import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { devStorage } from "./server/devStorage";

// `base: "./"` keeps asset paths relative, so the built site works from any
// sub-folder (e.g. https://<user>.github.io/hikers-notebook/).
export default defineConfig({
  base: "./",
  // `devStorage` lets the development server save parcours in the `data/` folder.
  plugins: [svelte(), devStorage()],
  // MapLibre's worker is located relative to its own module (see
  // src/lib/map.ts), so the library must not be moved by Vite's dev-time
  // pre-bundling.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
