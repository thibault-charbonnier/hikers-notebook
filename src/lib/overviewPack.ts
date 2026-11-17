/**
 * The overview map, always on the device.
 *
 * The home page shows a light map of France. A few megabytes of its tiles (the
 * low zoom levels only, so it stays light) are saved once, quietly, the first
 * time the app is used with a network. From then on the home page looks the
 * same without network.
 *
 * What is saved, in a cache named ``overview``: the vector tiles of France
 * from zoom 3 to 5, the relief picture tiles of the same area, the fonts of
 * the labels, and the TileJSON that says where the tiles are. Zoom levels
 * beyond 5 are drawn from the zoom-5 tiles (a little less detailed, which is
 * fine for finding one's way to a parcours).
 */

import { saveAll } from "./offlineDownload";
import { getMeta, setMeta } from "./offlineStore";
import { rectangleTiles, tileUrl, type Tile } from "./tilePlan";

/** Change it to make every device save the pack again. */
const PACK_VERSION = 2;
const CACHE_NAME = "overview";
const META_KEY = "overview-pack";

/** France with a margin, so neighbouring towns are not cut off at the edge. */
const AREA: [[number, number], [number, number]] = [
  [-6.5, 40.7],
  [10.8, 51.7],
];
/**
 * Zoom levels saved. Below 3 the map is never shown (it is not allowed to zoom out further than
 * France fills the screen, about zoom 3.5 on a phone and 4.4 on a computer). Above 5 the tiles
 * weigh a lot more for little gain on a light map; the zoom-5 tiles are enlarged instead.
 * Measured in November 2026: zoom 3 to 5 is about 11 MB, zoom 3 to 6 about 17 MB.
 */
const MIN_ZOOM = 3;
const MAX_ZOOM = 5;

const TILEJSON_URL = "https://tiles.openfreemap.org/planet";
const RELIEF_TEMPLATE = "https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png";
const GLYPHS_TEMPLATE = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FONTS = ["Noto Sans Bold", "Noto Sans Regular"];
const GLYPH_RANGES = ["0-255", "256-511", "8192-8447"];

export interface PackState {
  version: number;
  savedAt: string;
  bytes: number;
}

/** Say whether the overview map is already saved on this device. */
export async function overviewPackState(): Promise<PackState | undefined> {
  const state = await getMeta<PackState>(META_KEY);
  return state?.version === PACK_VERSION ? state : undefined;
}

/**
 * Save the overview map, unless it already is.
 *
 * Does nothing if the browser asks to save data, and fails quietly (it will
 * simply be tried again at the next start).
 *
 * Returns
 * -------
 * bool
 *     True if the pack is on the device when the call ends.
 */
export async function ensureOverviewPack(): Promise<boolean> {
  if (await overviewPackState()) return true;
  const connection = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;

  try {
    await caches.delete(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);

    const response = await fetch(TILEJSON_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status} for the overview TileJSON`);
    const copy = response.clone();
    await cache.put(TILEJSON_URL, response);
    const vectorTemplate: string = (await copy.json()).tiles[0];

    const tiles: Tile[] = [];
    for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) tiles.push(...rectangleTiles(AREA, z));
    const addresses = [
      ...tiles.map((tile) => tileUrl(vectorTemplate, tile)),
      ...tiles.map((tile) => tileUrl(RELIEF_TEMPLATE, tile)),
      ...FONTS.flatMap((font) =>
        GLYPH_RANGES.map((range) => GLYPHS_TEMPLATE.replace("{fontstack}", encodeURIComponent(font)).replace("{range}", range)),
      ),
    ];
    const { bytes, failed } = await saveAll(cache, addresses, new AbortController().signal, () => {});
    if (failed.length > addresses.length * 0.05) throw new Error(`${failed.length} overview files could not be downloaded`);
    await setMeta(META_KEY, { version: PACK_VERSION, savedAt: new Date().toISOString(), bytes } satisfies PackState);
    return true;
  } catch (error) {
    console.warn("The overview map could not be saved for offline use", error);
    await caches.delete(CACHE_NAME);
    return false;
  }
}
