/**
 * Vite plugin that writes the service worker (`sw.js`) at build time.
 *
 * It takes the template `plugins/sw-template.js` and fills in:
 *
 * - the list of files to save for offline use: everything Vite built (the
 *   page, scripts, styles, fonts, images) and everything in `public/`;
 * - a version, computed from the content of those files, so a new build gives
 *   the browser a new worker and the old saved files are dropped.
 *
 * It does nothing in development (the dev server rewrites files all the time;
 * test the offline mode on the built site with `npm run build` and
 * `npm run preview`).
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

/** All files under ``folder``, as paths relative to ``root`` (default: ``folder``), with forward slashes. */
function listFiles(folder: string, root = folder): string[] {
  const found: string[] = [];
  for (const name of readdirSync(folder)) {
    const full = join(folder, name);
    if (statSync(full).isDirectory()) found.push(...listFiles(full, root));
    else found.push(relative(root, full).split("\\").join("/"));
  }
  return found;
}

export function serviceWorker(): Plugin {
  let publicDir = "";
  return {
    name: "hikers-notebook-service-worker",
    apply: "build",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle);
      const hash = createHash("sha1");
      built.sort().forEach((name) => hash.update(name));

      // Files copied as they are from public/: their names do not change with
      // their content, so the content goes into the version.
      const copied = listFiles(publicDir).sort();
      copied.forEach((name) => hash.update(name).update(readFileSync(join(publicDir, name))));

      // The page itself is added by Vite after this step, so it is listed by hand.
      const files = ["index.html", ...built, ...copied].filter((name, i, all) => name !== "sw.js" && all.indexOf(name) === i);
      const template = readFileSync(join(import.meta.dirname, "sw-template.js"), "utf-8");
      hash.update(template); // a change in the worker itself is a new version too
      const source = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__PRECACHE__", JSON.stringify(files, null, 2));

      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
