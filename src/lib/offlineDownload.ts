/**
 * Download a parcours for offline use: everything the planning map needs to
 * show it with no network.
 *
 * What is saved, for one parcours, in one cache named ``offline-<id>``:
 *
 * - the Plan IGN map tiles along the route (a corridor of 1 km each side),
 *   from zoom 4 (all of France) to zoom 16. Deeper zooms are drawn from the
 *   zoom-16 tiles: they are vector tiles (drawings, not pictures), so they
 *   scale without getting blurry; the map is told not to ask for more (see
 *   ``capPlanIgnZoom`` in mapStyles.ts);
 * - the files the map needs to draw those tiles: its style, the little
 *   pictures (sprite) and the fonts;
 * - optionally the relief tiles for the 3D view (see terrain.ts).
 *
 * Saved files are answered by the service worker (see plugins/sw-template.js)
 * when the network is not there. Because they live in the browser's own file
 * cache, with their exact web address, nothing in the map code has to know
 * that it is offline.
 */

import type { LngLat } from "./geo";
import { IGN_STYLE_URL } from "./mapStyles";
import { decodeSegment } from "./parcours";
import type { ParcoursFile } from "./parcours";
import { DEM_TILE_TEMPLATE } from "./terrain";
import { corridorTiles, tileUrl, type Tile } from "./tilePlan";

/** Zoom levels saved for the Plan IGN. */
export const IGN_ZOOMS = { min: 4, max: 16 };
/** Zoom levels saved for the relief (it is drawn from zoom 12 up, see terrain.ts). */
export const RELIEF_ZOOMS = { min: 6, max: 12 };
/** How far from the route the saved corridor reaches, in meters. */
export const CORRIDOR_METERS = 1000;

/** Fonts are cut in ranges of characters: these cover French text and typographic punctuation. */
const GLYPH_RANGES = ["0-255", "256-511", "8192-8447"];

/**
 * Requests made at the same time: a good citizen towards the map servers. The IGN
 * servers sometimes answer "502" to a burst of requests, so this is kept modest.
 */
const PARALLEL_REQUESTS = 4;
/** How many times a file is tried before the download gives up. */
const MAX_ATTEMPTS = 6;
/** A request that has not answered (headers and body) after this long counts as failed and is tried again. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Average size in kilobytes of a Plan IGN tile, per zoom level.
 *
 * Measured on the real download of the Chartreuse massif (a mountain area,
 * so heavier than most of France) in November 2026.
 */
const IGN_TILE_KB: Record<number, number> = {
  4: 311, 5: 125, 6: 62, 7: 111, 8: 52, 9: 18, 10: 462, 11: 168, 12: 148, 13: 81, 14: 32, 15: 10, 16: 4,
};
/** Average size of a relief tile in kilobytes. */
const RELIEF_TILE_KB = 130;
/** Style (280 kB), sprite (630 kB) and fonts (780 kB). */
const SUPPORT_KB = 1700;

export interface DownloadPlan {
  ignTiles: Tile[];
  reliefTiles: Tile[];
  /** Number of files that will be fetched (tiles plus the style files). */
  fileCount: number;
  estimatedBytes: number;
}

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
  /** Files that failed and are waiting to be tried again (the server is struggling). */
  retrying: number;
}

/** Name of the cache that holds the map files of a parcours. */
export const cacheNameFor = (id: string): string => `offline-${id}`;

/** The route of a parcours as one list of positions. */
export function routeOf(file: ParcoursFile): LngLat[] {
  return file.segments.flatMap((stored) => decodeSegment(stored).coordinates);
}

/**
 * Work out what a download would fetch, and roughly how much it weighs.
 *
 * Parameters
 * ----------
 * file : ParcoursFile
 *     The parcours.
 * include3d : bool
 *     Whether to include the relief tiles.
 *
 * Returns
 * -------
 * DownloadPlan
 *     The tiles, the number of files and the estimated size.
 */
export function planDownload(file: ParcoursFile, include3d: boolean): DownloadPlan {
  const line = routeOf(file);
  const ignTiles: Tile[] = [];
  for (let z = IGN_ZOOMS.min; z <= IGN_ZOOMS.max; z++) ignTiles.push(...corridorTiles(line, z, CORRIDOR_METERS));
  const reliefTiles: Tile[] = [];
  if (include3d) {
    for (let z = RELIEF_ZOOMS.min; z <= RELIEF_ZOOMS.max; z++) reliefTiles.push(...corridorTiles(line, z, CORRIDOR_METERS));
  }
  const ignKb = ignTiles.reduce((sum, tile) => sum + (IGN_TILE_KB[tile.z] ?? 50), 0);
  const reliefKb = reliefTiles.length * RELIEF_TILE_KB;
  return {
    ignTiles,
    reliefTiles,
    fileCount: ignTiles.length + reliefTiles.length + 8,
    estimatedBytes: (ignKb + reliefKb + SUPPORT_KB) * 1024,
  };
}

/** The fonts a style asks for (each ``text-font`` setting, plain or zoom-dependent). */
function fontsOf(style: { layers: Array<{ layout?: Record<string, unknown> }> }): Set<string> {
  const stacks = new Set<string>();
  const add = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value[0] === "literal") return add(value[1]);
    if (value.every((name) => typeof name === "string")) stacks.add(value.join(","));
  };
  for (const layer of style.layers) {
    const font = layer.layout?.["text-font"];
    if (font && typeof font === "object" && "stops" in font) {
      for (const stop of (font as { stops: unknown[][] }).stops) add(stop[1]);
    } else {
      add(font);
    }
  }
  return stacks;
}

/** Wait a little (between two attempts); cancelling interrupts the wait. */
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      },
      { once: true },
    );
  });

/** Told when a file starts waiting to be tried again, and when it stops. */
interface RetryHooks {
  wait: () => void;
  resume: () => void;
}

/** Wait before trying again: 0.5 s, 1 s, 2 s, 4 s, 8 s, each a bit randomised so requests do not move in step. */
const backoff = (attempt: number): number => Math.min(8000, 500 * 2 ** attempt) * (0.6 + Math.random() * 0.8);

/**
 * Fetch an address, trying again after a growing wait if the server has a hiccup
 * (502, 503, 429...) or the network fails.
 *
 * Returns
 * -------
 * Response
 *     The answer: a good one, or a 404 that stayed (some areas simply have no tile; the map handles that).
 */
async function fetchWithRetry(address: string, signal: AbortSignal, hooks?: RetryHooks): Promise<Response> {
  let waiting = false; // true from the first failure until this file is settled
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        // From the second try on, skip the browser's own cache (it may hold an error it was given),
        // and from the fourth also ask for a slightly different address (the server ignores the
        // extra word, but a cache standing between us and the server may have kept a bad answer for
        // the exact address). The answer is saved under the normal address either way.
        const asked = attempt >= 3 ? `${address}${address.includes("?") ? "&" : "?"}retry=${attempt}` : address;
        const response = await fetch(asked, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
          cache: attempt >= 1 ? "reload" : "default",
        });
        if (response.ok) return response;
        // A 404 is usually a tile that does not exist, but it may also be a bad answer kept by a cache
        // on the way: believe it only after the tries that skip the caches (the fourth is the last of them).
        if (response.status === 404 && attempt >= 3) return response;
        throw new Error(`HTTP ${response.status} for ${address}`);
      } catch (error) {
        if (signal.aborted || attempt >= MAX_ATTEMPTS - 1) throw error;
        if (!waiting) {
          hooks?.wait();
          waiting = true;
        }
        await sleep(backoff(attempt), signal);
      }
    }
  } finally {
    if (waiting) hooks?.resume();
  }
}

/**
 * Save the answer for an address in a cache.
 *
 * A file that is already in the cache is kept as it is (so an interrupted
 * download resumes where it stopped).
 *
 * Returns
 * -------
 * int
 *     Size of the file now in the cache in bytes (0 for a missing tile).
 */
async function save(cache: Cache, address: string, signal: AbortSignal, hooks: RetryHooks): Promise<number> {
  const existing = await cache.match(address);
  if (existing) return (await existing.blob()).size;

  const response = await fetchWithRetry(address, signal, hooks);
  if (response.status === 404) return 0;
  const copy = response.clone();
  const [, size] = await Promise.all([cache.put(address, response), copy.arrayBuffer().then((b) => b.byteLength)]);
  return size;
}

/**
 * Fetch a list of addresses and save the answers in a cache, a few at a time.
 *
 * A file that still fails after all its tries does not stop the others: it is
 * reported at the end, so a single stubborn tile cannot keep a whole download
 * from finishing.
 *
 * Parameters
 * ----------
 * cache : Cache
 *     Where to save.
 * addresses : list of str
 *     The files to fetch.
 * signal : AbortSignal
 *     Abort it to stop at once.
 * onProgress : function
 *     Called each time a file is done, or starts or stops waiting for a new try.
 *
 * Returns
 * -------
 * object
 *     ``saved``: number of files kept (missing tiles are not); ``bytes``: their
 *     size; ``failed``: the addresses that could not be fetched.
 *
 * Raises
 * ------
 * AbortError
 *     If ``signal`` was aborted.
 */
export async function saveAll(
  cache: Cache,
  addresses: string[],
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void,
): Promise<{ saved: number; bytes: number; failed: string[] }> {
  let done = 0;
  let bytes = 0;
  let saved = 0;
  let next = 0;
  let retrying = 0;
  const failed: string[] = [];

  const report = () => onProgress({ done, total: addresses.length, bytes, retrying });
  const hooks: RetryHooks = {
    wait: () => {
      retrying++;
      report();
    },
    resume: () => {
      retrying--;
      report();
    },
  };

  const runner = async (): Promise<void> => {
    while (next < addresses.length) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const address = addresses[next++];
      try {
        const size = await save(cache, address, signal, hooks);
        bytes += size;
        if (size > 0) saved++;
      } catch (error) {
        if (signal.aborted) throw error;
        failed.push(address);
      }
      done++;
      report();
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, runner));
  return { saved, bytes, failed };
}

/**
 * Download a parcours for offline use.
 *
 * Parameters
 * ----------
 * file : ParcoursFile
 *     The parcours (saved in the database).
 * options : object
 *     ``include3d``: also save the relief tiles; ``signal``: abort to cancel;
 *     ``onProgress``: called as files arrive.
 *
 * Returns
 * -------
 * object
 *     ``fileCount`` and ``bytes`` of what was saved, the ``cacheName``, and
 *     ``missing``: how many tiles could not be fetched (a few are tolerated).
 *
 * Raises
 * ------
 * Error
 *     If a file could not be fetched (after several tries), or if the download
 *     was cancelled. What was already saved is kept, and a new attempt resumes.
 */
export async function downloadForOffline(
  file: ParcoursFile,
  options: { include3d: boolean; signal: AbortSignal; onProgress: (progress: DownloadProgress) => void },
): Promise<{ fileCount: number; bytes: number; cacheName: string; missing: number }> {
  const { include3d, signal, onProgress } = options;
  const cacheName = cacheNameFor(file.id);
  // The cache is kept if it exists: files already saved are not fetched again, so a download that
  // failed halfway resumes, and an update only fetches what the new route needs.
  const cache = await caches.open(cacheName);

  // The style says where the tiles, sprite and fonts are.
  const styleResponse = await fetchWithRetry(IGN_STYLE_URL, signal);
  if (!styleResponse.ok) throw new Error(`HTTP ${styleResponse.status} for the map style`);
  const copy = styleResponse.clone();
  await cache.put(IGN_STYLE_URL, styleResponse);
  const style = await copy.json();

  const support: string[] = [];
  for (const suffix of [".json", ".png", "@2x.json", "@2x.png"]) support.push(`${style.sprite}${suffix}`);
  for (const font of fontsOf(style)) {
    for (const range of GLYPH_RANGES) {
      support.push(style.glyphs.replace("{fontstack}", encodeURIComponent(font)).replace("{range}", range));
    }
  }

  const plan = planDownload(file, include3d);
  const ignTemplate: string = style.sources.plan_ign.tiles[0];
  const addresses = [
    ...support,
    ...plan.ignTiles.map((tile) => tileUrl(ignTemplate, tile)),
    ...plan.reliefTiles.map((tile) => tileUrl(DEM_TILE_TEMPLATE, tile)),
  ];

  onProgress({ done: 1, total: addresses.length + 1, bytes: 0, retrying: 0 });
  const result = await saveAll(cache, addresses, signal, (progress) =>
    onProgress({ ...progress, done: progress.done + 1, total: progress.total + 1 }),
  );

  // Without the sprite or the fonts the map cannot be drawn: that is a failure. A few missing
  // tiles are tolerated (they leave small holes, and "Mettre à jour" tries them again), but not many.
  const essential = new Set(support);
  if (result.failed.some((address) => essential.has(address))) {
    throw new Error("The map style files could not be downloaded");
  }
  if (result.failed.length > Math.max(5, addresses.length * 0.05)) {
    throw new Error(`${result.failed.length} map files could not be downloaded (first: ${result.failed[0]})`);
  }
  return { fileCount: result.saved + 1, bytes: result.bytes, cacheName, missing: result.failed.length }; // + the style
}

/** Remove the map files saved for a parcours. */
export async function removeOfflineFiles(id: string): Promise<void> {
  await caches.delete(cacheNameFor(id));
}
