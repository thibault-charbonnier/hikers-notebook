/**
 * Local storage for parcours, for development only.
 *
 * A web page cannot write files by itself, so the development server (the one
 * started by ``npm run dev``) offers a tiny API that reads and writes plain
 * JSON files in the ``data/`` folder of the project:
 *
 * - ``GET /api/parcours``       list of parcours, without their heavy parts
 * - ``GET /api/parcours/<id>``  one whole parcours
 * - ``PUT /api/parcours/<id>``  create or replace a parcours
 * - ``DELETE /api/parcours/<id>``
 * - ``GET /api/labels``, ``PUT /api/labels``  the list of labels
 *
 * This is temporary: the folder is ignored by git, and the storage will move
 * elsewhere (private repository, browser database) later. The app only talks
 * to it through ``src/lib/storage.ts``.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/** Parts of a parcours that are left out of the list (they are the heavy ones). */
const HEAVY_FIELDS = ["waypoints", "segments", "pois"];

function send(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/** Write a file in one go, so a crash never leaves half a file. */
async function writeAtomically(path: string, text: string): Promise<void> {
  await writeFile(`${path}.tmp`, text, "utf-8");
  await rename(`${path}.tmp`, path);
}

/** Read a JSON file, or return ``fallback`` if it does not exist. */
async function readJson(path: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

/**
 * Vite plugin adding the storage API to the development server.
 *
 * Returns
 * -------
 * Plugin
 *     The plugin, to be listed in ``vite.config.ts``.
 */
export function devStorage(): Plugin {
  return {
    name: "dev-storage",
    apply: "serve",
    configureServer(server) {
      const dataDir = join(server.config.root, "data");
      const parcoursDir = join(dataDir, "parcours");
      const labelsFile = join(dataDir, "labels.json");

      /** Answer one API request. */
      async function handle(request: IncomingMessage, response: ServerResponse, resource: string, id?: string) {
        if (resource === "labels") {
          if (request.method === "PUT") {
            const labels = JSON.parse(await readBody(request));
            if (!Array.isArray(labels)) return send(response, 400, { error: "Labels must be a list" });
            await mkdir(dataDir, { recursive: true });
            await writeAtomically(labelsFile, JSON.stringify(labels, null, 2));
            return send(response, 200, labels);
          }
          return send(response, 200, await readJson(labelsFile, []));
        }

        if (resource !== "parcours") return send(response, 404, { error: "Unknown resource" });

        if (id === undefined) {
          let names: string[] = [];
          try {
            names = (await readdir(parcoursDir)).filter((name) => name.endsWith(".json"));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          const summaries = [];
          for (const name of names) {
            const file = (await readJson(join(parcoursDir, name), null)) as Record<string, unknown> | null;
            if (file) summaries.push(Object.fromEntries(Object.entries(file).filter(([key]) => !HEAVY_FIELDS.includes(key))));
          }
          return send(response, 200, summaries);
        }

        if (!ID_PATTERN.test(id)) return send(response, 400, { error: "Invalid id" });
        const path = join(parcoursDir, `${id}.json`);

        if (request.method === "PUT") {
          const file = JSON.parse(await readBody(request));
          if (file?.id !== id) return send(response, 400, { error: "The id of the file does not match the address" });
          await mkdir(parcoursDir, { recursive: true });
          await writeAtomically(path, JSON.stringify(file));
          return send(response, 200, { ok: true });
        }
        if (request.method === "DELETE") {
          await unlink(path).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
          return send(response, 200, { ok: true });
        }
        const file = await readJson(path, null);
        return file ? send(response, 200, file) : send(response, 404, { error: "Not found" });
      }

      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "", "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();
        const [resource, id] = url.pathname.split("/").slice(2);
        try {
          await handle(request, response, resource, id);
        } catch (error) {
          send(response, 500, { error: String(error) });
        }
      });
    },
  };
}
