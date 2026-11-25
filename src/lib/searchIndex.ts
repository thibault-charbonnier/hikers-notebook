/**
 * What can be searched on the home map: summits and passes, massifs, GR
 * trails and regional parks. The names come from the same data files as the
 * map layers (``public/data``); they are downloaded the first time the search
 * box is used, then kept. How names are compared is in search.ts.
 */

import { highlight, parseQuery, prepare, score, type Searchable } from "./search";

export type PlaceKind = "peak" | "gr" | "massif" | "park";

/** One thing the search can find. */
export interface PlaceEntry {
  kind: PlaceKind;
  /** The name, as shown (and written in bold where it matches). */
  title: string;
  /** A grey line under the name: what it is (and its altitude, its region...). */
  subtitle: string;
  /** What is compared with what is typed: the name, and for a trail also its long name. */
  searchable: Searchable;
  /** The shown name alone, to find which of its letters matched (bold). */
  shown: Searchable;
  /** Added to the score, so that the greater summits and the massifs come first. */
  boost: number;
  /** A rough place to drive to (the summit, the middle of a massif or park); ``null`` for a trail, which is a route. */
  center: [number, number] | null;
  /** A point for a summit; a line or an area for the others. */
  geometry: { type: string; coordinates: unknown };
  /** Short text written on the map next to the highlighted place. */
  label: string;
}

/** A found place with its name cut in pieces (the bold ones matched what was typed). */
export interface PlaceMatch {
  entry: PlaceEntry;
  pieces: { text: string; bold: boolean }[];
}

const KIND_OF_PEAK: Record<string, string> = {
  sommet: "Sommet",
  pic: "Pic",
  montagne: "Montagne",
  volcan: "Volcan",
  col: "Col",
};

const dataUrl = (file: string): string => new URL(`data/${file}.geojson`, document.baseURI).href;

async function loadFile(file: string): Promise<{ features: any[] }> {
  const response = await fetch(dataUrl(file));
  if (!response.ok) throw new Error(`Search data failed (HTTP ${response.status})`);
  return response.json();
}

const meters = (ele: number): string => `${ele.toLocaleString("fr-FR")} m`;

/** Build the list of everything that can be found, from the data files. */
async function buildIndex(): Promise<PlaceEntry[]> {
  const [peaks, massifs, trails, parks] = await Promise.all(["peaks", "massifs", "gr-trails", "pnr"].map(loadFile));
  const entries: PlaceEntry[] = [];

  for (const feature of peaks.features) {
    const { name, type, ele, importance } = feature.properties;
    const kind = KIND_OF_PEAK[type];
    if (!kind) continue; // crests, cirques, gorges... are on the map but not searched
    const searchable = prepare(name);
    entries.push({
      kind: "peak",
      title: name,
      subtitle: typeof ele === "number" ? `${kind} · ${meters(ele)}` : kind,
      searchable,
      shown: searchable,
      boost: (7 - importance) * 8 + (typeof ele === "number" ? Math.min(ele, 4000) / 400 : 0),
      center: feature.geometry.coordinates,
      geometry: feature.geometry,
      label: typeof ele === "number" ? `${name}\n${meters(ele)}` : name,
    });
  }

  for (const feature of massifs.features) {
    const { name, zone, cx, cy } = feature.properties;
    const searchable = prepare(name);
    entries.push({
      kind: "massif",
      title: name,
      subtitle: `Massif${zone ? ` · ${zone}` : ""}`,
      searchable,
      shown: searchable,
      boost: 20,
      center: [cx, cy],
      geometry: feature.geometry,
      label: name,
    });
  }

  for (const feature of trails.features) {
    if (feature.geometry.type === "Point") continue; // the points only carry the names written on the map
    const { ref, name, rank } = feature.properties;
    // "gr20" (no space) must find "GR 20" too.
    const compact = ref.toLowerCase().replace(/\s+/g, "");
    entries.push({
      kind: "gr",
      title: ref,
      subtitle: name && name !== ref ? `Sentier GR · ${name}` : "Sentier GR",
      searchable: prepare(`${ref} ${name ?? ""}`, [compact]),
      shown: prepare(ref),
      boost: rank === 1 ? 25 : 10,
      center: null,
      geometry: feature.geometry,
      label: ref,
    });
  }

  for (const feature of parks.features) {
    const { name } = feature.properties;
    const searchable = prepare(name);
    entries.push({
      kind: "park",
      title: name,
      subtitle: "Parc naturel régional",
      searchable,
      shown: searchable,
      boost: 15,
      center: [feature.properties.cx, feature.properties.cy],
      geometry: feature.geometry,
      label: feature.properties.short ?? name,
    });
  }
  return entries;
}

let pending: Promise<PlaceEntry[]> | null = null;

/** The list of everything that can be found (downloaded once, on first use). */
export function loadSearchIndex(): Promise<PlaceEntry[]> {
  if (!pending) {
    pending = buildIndex().catch((error) => {
      pending = null; // try again next time
      throw error;
    });
  }
  return pending;
}

/**
 * Search the index, forgiving small spelling mistakes.
 *
 * Parameters
 * ----------
 * index : list of PlaceEntry
 *     As returned by ``loadSearchIndex``.
 * query : str
 *     What the person typed.
 * limit : int
 *     How many results to return at most.
 *
 * Returns
 * -------
 * list of PlaceMatch
 *     The best results first, each with its name cut in bold and plain pieces.
 */
export function searchPlaces(index: PlaceEntry[], query: string, limit = 8): PlaceMatch[] {
  const typed = parseQuery(query);
  if (typed.length === 0) return [];
  const found: { entry: PlaceEntry; value: number }[] = [];
  for (const entry of index) {
    const value = score(typed, entry.searchable);
    if (value > 0) found.push({ entry, value: value + entry.boost });
  }
  found.sort((a, b) => b.value - a.value);
  return found.slice(0, limit).map(({ entry }) => ({
    entry,
    pieces: highlight(entry.title, entry.shown, typed),
  }));
}
