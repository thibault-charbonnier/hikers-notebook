/**
 * The "Explorer" layers of the home map: GR trails, regional natural parks
 * (hatched), massifs, and summits / passes.
 *
 * The data are static GeoJSON files in ``public/data`` (built by the scripts in
 * ``tools/``). Every layer is added once, hidden, when the map has loaded;
 * its data file is only downloaded the first time its switch is turned on.
 * Everything sits under the place names and under the saved parcours.
 *
 * Summits are shown by importance as the map is zoomed in (the greatest from
 * far away, all of them from close): one layer per importance level, each with
 * its own minimum zoom. (A filter cannot depend on the zoom, a layer can.)
 */

import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { ExploreChoices } from "./exploreChoices";

type Group = "massifs" | "parks" | "gr" | "peaks";

/** Data file and credit of each group. */
const SOURCES: Record<Group, { file: string; attribution: string }> = {
  massifs: { file: "massifs", attribution: '© <a href="https://www.refuges.info">refuges.info</a> (CC BY-SA)' },
  parks: { file: "pnr", attribution: '<a href="https://geoservices.ign.fr">© IGN</a> (BD TOPO)' },
  gr: { file: "gr-trails", attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  peaks: { file: "peaks", attribution: '<a href="https://geoservices.ign.fr">© IGN</a> (BD TOPO, RGE ALTI)' },
};

const sourceId = (group: Group): string => `explore-${group}`;
const dataUrl = (group: Group): string => new URL(`data/${SOURCES[group].file}.geojson`, document.baseURI).href;

/** Layers are added just before this one of the home style, so place names stay on top. */
const ANCHOR = "country-labels";
const HATCH_IMAGE = "explore-hatch";

/** Zoom from which each importance level of summits is shown (1 is the greatest). */
const PEAK_MIN_ZOOM: Record<number, number> = { 1: 4.5, 2: 6, 3: 7.5, 4: 9.5, 5: 10.8, 6: 12 };
const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5, 6];

const SUMMIT_TYPES = ["sommet", "pic", "montagne", "volcan"];
const PASS_TYPES = ["col"];
const OTHER_TYPES = ["crete", "cirque", "gorge", "escarpement"];

/** Names of the kinds of landmark, for the cards. */
export const PEAK_KIND: Record<string, string> = {
  sommet: "Sommet",
  pic: "Pic",
  montagne: "Montagne",
  volcan: "Volcan",
  col: "Col",
  crete: "Crête",
  cirque: "Cirque",
  gorge: "Gorge",
  escarpement: "Escarpement",
};

const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const GR_RED = "#C0262D";
const PARK_GREEN = "#3F8F4A";
const MASSIF_BROWN = "#8A4F17";

/** The GR layers: the big GR (rank 1) from far away, the others (variants and links) from closer. */
const GR_LAYERS = [
  "explore-gr-casing-2",
  "explore-gr-casing",
  "explore-gr-line-2",
  "explore-gr-line",
  "explore-gr-label-2",
  "explore-gr-label",
  "explore-gr-label-near",
  "explore-gr-label-2-near",
];
/** Zoom from which the GR of rank 2 appear. */
const GR_RANK2_ZOOM = 7.5;

const peakDotId = (importance: number): string => `explore-peaks-dot-${importance}`;
const peakLabelId = (importance: number): string => `explore-peaks-label-${importance}`;

/** Ids of every layer of a group, to show or hide them together. */
function layerIds(group: Group): string[] {
  switch (group) {
    case "massifs":
      return ["explore-massifs-fill", "explore-massifs-line", "explore-massifs-label"];
    case "parks":
      return ["explore-parks-fill", "explore-parks-line", "explore-parks-label"];
    case "gr":
      return GR_LAYERS;
    case "peaks":
      return IMPORTANCE_LEVELS.flatMap((level) => [peakDotId(level), peakLabelId(level)]);
  }
}

/** Ids of the layers a click can find something on, for ``describeAt``. */
export const PEAK_DOT_LAYERS = IMPORTANCE_LEVELS.map(peakDotId);

/** A diagonal hatching, as a small picture, for the parks. */
function hatchImage(): ImageData {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.strokeStyle = PARK_GREEN;
  context.lineWidth = 2;
  context.lineCap = "square";
  for (const offset of [-size, 0, size]) {
    context.beginPath();
    context.moveTo(offset, size);
    context.lineTo(offset + size, 0);
    context.stroke();
  }
  return context.getImageData(0, 0, size, size);
}

const hidden = { visibility: "none" } as const;
const empty = { type: "FeatureCollection", features: [] } as const;
const HIGHLIGHT_SOURCE = "explore-hl";
const HIGHLIGHT_COLOR = "#E8590C";

/**
 * Add the sources (empty) and the layers (hidden) of the Explorer to the home map.
 *
 * Parameters
 * ----------
 * map : Map
 *     The home map, once its style has loaded.
 */
export function addExploreLayers(map: MapLibreMap): void {
  map.addImage(HATCH_IMAGE, hatchImage(), { pixelRatio: 2 });
  for (const group of Object.keys(SOURCES) as Group[]) {
    map.addSource(sourceId(group), { type: "geojson", data: empty, attribution: SOURCES[group].attribution });
  }

  const halo = { "text-halo-color": "rgba(244,241,232,0.92)", "text-halo-width": 1.5 };
  const layers: LayerSpecification[] = [
    // Massifs: an outline, and an almost invisible fill so a click can find the massif.
    {
      id: "explore-massifs-fill",
      type: "fill",
      source: sourceId("massifs"),
      layout: hidden,
      paint: { "fill-color": MASSIF_BROWN, "fill-opacity": 0.01 },
    },
    {
      id: "explore-massifs-line",
      type: "line",
      source: sourceId("massifs"),
      minzoom: 5,
      layout: { ...hidden, "line-join": "round" },
      paint: { "line-color": MASSIF_BROWN, "line-width": 1.2, "line-opacity": 0.7 },
    },
    // Parks: hatched, with an outline.
    {
      id: "explore-parks-fill",
      type: "fill",
      source: sourceId("parks"),
      layout: hidden,
      paint: { "fill-pattern": HATCH_IMAGE, "fill-opacity": 0.5 },
    },
    {
      id: "explore-parks-line",
      type: "line",
      source: sourceId("parks"),
      layout: { ...hidden, "line-join": "round" },
      paint: { "line-color": PARK_GREEN, "line-width": 1.2, "line-opacity": 0.85 },
    },
    // GR trails: a white casing under a red line; the big GR (rank 1) from far away, the rest from closer.
    ...[2, 1].flatMap((rank): LayerSpecification[] => {
      const suffix = rank === 1 ? "" : "-2";
      const filter: ExpressionSpecification = ["==", ["get", "rank"], rank];
      const minzoom = rank === 1 ? 0 : GR_RANK2_ZOOM;
      const layout = { ...hidden, "line-join": "round", "line-cap": "round" } as const;
      return [
        {
          id: `explore-gr-casing${suffix}`,
          type: "line",
          source: sourceId("gr"),
          filter,
          minzoom,
          layout,
          paint: {
            "line-color": "#FFFFFF",
            "line-opacity": 0.75,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 9, 3.8, 12, 5.5],
          },
        },
        {
          id: `explore-gr-line${suffix}`,
          type: "line",
          source: sourceId("gr"),
          filter,
          minzoom,
          layout,
          paint: {
            "line-color": GR_RED,
            "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 9, 2, 12, 3],
          },
        },
      ];
    }),
    // Summits: one dot layer per importance level (the least important at the bottom).
    ...[...IMPORTANCE_LEVELS].reverse().map(
      (level): LayerSpecification => ({
        id: peakDotId(level),
        type: "circle",
        source: sourceId("peaks"),
        minzoom: PEAK_MIN_ZOOM[level],
        layout: hidden,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 4.5],
          "circle-color": ["case", ["==", ["get", "type"], "col"], "#B07A2A", "#2B312D"],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.2,
        },
      }),
    ),
    // Labels, on top of all of that.
    {
      id: "explore-massifs-label",
      type: "symbol",
      source: sourceId("massifs"),
      minzoom: 6,
      layout: {
        ...hidden,
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10.5, 10, 14],
        "text-max-width": 8,
      },
      paint: { "text-color": MASSIF_BROWN, ...halo },
    },
    {
      id: "explore-parks-label",
      type: "symbol",
      source: sourceId("parks"),
      minzoom: 7,
      layout: {
        ...hidden,
        "text-field": ["get", "short"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 11, 13],
        "text-max-width": 7,
      },
      paint: { "text-color": "#2C6A35", ...halo },
    },
    ...[...IMPORTANCE_LEVELS].reverse().map(
      (level): LayerSpecification => ({
        id: peakLabelId(level),
        type: "symbol",
        source: sourceId("peaks"),
        minzoom: PEAK_MIN_ZOOM[level],
        layout: {
          ...hidden,
          "text-field": [
            "case",
            ["==", ["typeof", ["get", "ele"]], "number"],
            ["concat", ["get", "name"], "\n", ["to-string", ["get", "ele"]], " m"],
            ["get", "name"],
          ],
          "text-font": FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 12, 12.5],
          "text-anchor": "top",
          "text-offset": [0, 0.7],
          "text-max-width": 8,
          "text-optional": true,
        },
        paint: { "text-color": "#1F2A24", ...halo },
      }),
    ),
    // The GR numbers come last, so they win over the names of the summits when both want the same place.
    // Sparse points (every 25 km) are used from far away; dense ones (every 3 km) once zoomed in, so a number
    // is always in view. The names sit on points (a winding trail cannot carry text along it).
    ...[
      { id: "explore-gr-label", rank: 1, density: 1, minzoom: 4 },
      { id: "explore-gr-label-2", rank: 2, density: 1, minzoom: 9 },
      { id: "explore-gr-label-near", rank: 1, density: 2, minzoom: 9.5 },
      { id: "explore-gr-label-2-near", rank: 2, density: 2, minzoom: 10.5 },
    ].map(
      ({ id, rank, density, minzoom }): LayerSpecification => ({
        id,
        type: "symbol",
        source: sourceId("gr"),
        filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "rank"], rank], ["==", ["get", "density"], density]],
        minzoom,
        layout: {
          ...hidden,
          "text-field": ["get", "ref"],
          "text-font": FONT_BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9.5, 9, 11.5, 13, 13],
          "text-padding": 6,
        },
        paint: { "text-color": GR_RED, "text-halo-color": "#FFFFFF", "text-halo-width": 2 },
      }),
    ),
  ];
  // The place chosen in the search box: drawn over everything else, whatever the filters say.
  map.addSource(HIGHLIGHT_SOURCE, { type: "geojson", data: empty });
  const isLine: ExpressionSpecification = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]];
  const isArea: ExpressionSpecification = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]];
  layers.push(
    { id: "explore-hl-fill", type: "fill", source: HIGHLIGHT_SOURCE, filter: isArea, paint: { "fill-color": HIGHLIGHT_COLOR, "fill-opacity": 0.16 } },
    {
      id: "explore-hl-casing",
      type: "line",
      source: HIGHLIGHT_SOURCE,
      filter: ["!=", ["geometry-type"], "Point"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#FFFFFF", "line-width": 7, "line-opacity": 0.9 },
    },
    {
      id: "explore-hl-line",
      type: "line",
      source: HIGHLIGHT_SOURCE,
      filter: ["!=", ["geometry-type"], "Point"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": HIGHLIGHT_COLOR, "line-width": 3.6 },
    },
    {
      id: "explore-hl-dot",
      type: "circle",
      source: HIGHLIGHT_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 8, "circle-color": HIGHLIGHT_COLOR, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 2.5 },
    },
    {
      id: "explore-hl-label",
      type: "symbol",
      source: HIGHLIGHT_SOURCE,
      filter: ["all", ["!", isLine], ["!", isArea]] as ExpressionSpecification,
      layout: { "text-field": ["get", "label"], "text-font": FONT_BOLD, "text-size": 14, "text-anchor": "top", "text-offset": [0, 0.9], "text-max-width": 9 },
      paint: { "text-color": "#1F2A24", "text-halo-color": "#FFFFFF", "text-halo-width": 2.2 },
    },
    {
      id: "explore-hl-label-area",
      type: "symbol",
      source: HIGHLIGHT_SOURCE,
      filter: isArea,
      layout: { "text-field": ["get", "label"], "text-font": FONT_BOLD, "text-size": 16, "text-max-width": 9 },
      paint: { "text-color": "#8F3A06", "text-halo-color": "#FFFFFF", "text-halo-width": 2.4 },
    },
    {
      id: "explore-hl-label-line",
      type: "symbol",
      source: HIGHLIGHT_SOURCE,
      filter: isLine,
      layout: { "symbol-placement": "line", "symbol-spacing": 260, "text-field": ["get", "label"], "text-font": FONT_BOLD, "text-size": 14 },
      paint: { "text-color": "#8F3A06", "text-halo-color": "#FFFFFF", "text-halo-width": 2.4 },
    },
  );
  for (const layer of layers) map.addLayer(layer, ANCHOR);
}

/** Groups whose data file has already been asked for, per map. */
const loadedGroups = new WeakMap<MapLibreMap, Set<Group>>();

/** Make a layer visible or hidden, if it exists. */
function show(map: MapLibreMap, id: string, visible: boolean): void {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

/** The filter of one importance level of summits, for the types and the lowest altitude chosen. */
function peakFilter(choices: ExploreChoices, importance: number): ExpressionSpecification {
  const types = [
    ...(choices.summits ? SUMMIT_TYPES : []),
    ...(choices.passes ? PASS_TYPES : []),
    ...(choices.others ? OTHER_TYPES : []),
  ];
  return [
    "all",
    ["==", ["get", "importance"], importance],
    ["in", ["get", "type"], ["literal", types]],
    [">=", ["coalesce", ["get", "ele"], 0], choices.minEle],
  ];
}

/**
 * Show, hide and filter the Explorer layers to match what is chosen.
 *
 * Parameters
 * ----------
 * map : Map
 *     The home map, with ``addExploreLayers`` done.
 * choices : ExploreChoices
 *     What is chosen in the Explorer window.
 */
export function syncExplore(map: MapLibreMap, choices: ExploreChoices): void {
  const wanted: Record<Group, boolean> = {
    massifs: choices.massifs,
    parks: choices.parks,
    gr: choices.gr,
    peaks: choices.peaks && (choices.summits || choices.passes || choices.others),
  };

  // A data file is downloaded the first time its layers are wanted.
  const loaded = loadedGroups.get(map) ?? new Set<Group>();
  loadedGroups.set(map, loaded);
  for (const group of Object.keys(wanted) as Group[]) {
    if (wanted[group] && !loaded.has(group)) {
      loaded.add(group);
      (map.getSource(sourceId(group)) as GeoJSONSource | undefined)?.setData(dataUrl(group));
    }
    for (const id of layerIds(group)) show(map, id, wanted[group]);
  }

  // Summits: types and lowest altitude.
  for (const level of IMPORTANCE_LEVELS) {
    for (const id of [peakDotId(level), peakLabelId(level)]) if (map.getLayer(id)) map.setFilter(id, peakFilter(choices, level));
  }
}

/** What the layers look like normally, and when a place is highlighted (so the others fade): layer, property, normal, faded. */
const FADES: [string, "line-opacity" | "fill-opacity" | "text-opacity" | "circle-opacity", number, number][] = [
  ["explore-gr-casing", "line-opacity", 0.75, 0.15],
  ["explore-gr-casing-2", "line-opacity", 0.75, 0.15],
  ["explore-gr-line", "line-opacity", 1, 0.2],
  ["explore-gr-line-2", "line-opacity", 1, 0.2],
  ["explore-gr-label", "text-opacity", 1, 0.25],
  ["explore-gr-label-2", "text-opacity", 1, 0.25],
  ["explore-gr-label-near", "text-opacity", 1, 0.25],
  ["explore-gr-label-2-near", "text-opacity", 1, 0.25],
  ["explore-parks-fill", "fill-opacity", 0.5, 0.15],
  ["explore-parks-line", "line-opacity", 0.85, 0.25],
  ["explore-parks-label", "text-opacity", 1, 0.3],
  ["explore-massifs-line", "line-opacity", 0.7, 0.2],
  ["explore-massifs-label", "text-opacity", 1, 0.3],
  ...IMPORTANCE_LEVELS.flatMap((level): [string, "circle-opacity" | "text-opacity", number, number][] => [
    [peakDotId(level), "circle-opacity", 1, 0.3],
    [peakLabelId(level), "text-opacity", 1, 0.3],
  ]),
];

/** A place chosen in the search box, ready to be drawn. */
export interface HighlightedPlace {
  geometry: { type: string; coordinates: unknown };
  /** Text written on the map next to it. */
  label: string;
}

/**
 * Draw a place over the map (a trail, a massif, a park or a summit), and fade
 * everything else; or clear it.
 *
 * Parameters
 * ----------
 * map : Map
 *     The home map, with ``addExploreLayers`` done.
 * place : HighlightedPlace or null
 *     The place, or ``null`` to go back to the normal map.
 */
export function setHighlight(map: MapLibreMap, place: HighlightedPlace | null): void {
  (map.getSource(HIGHLIGHT_SOURCE) as GeoJSONSource | undefined)?.setData(
    place
      ? ({ type: "Feature", properties: { label: place.label }, geometry: place.geometry } as never)
      : empty,
  );
  for (const [id, property, normal, faded] of FADES) {
    if (map.getLayer(id)) map.setPaintProperty(id, property, place ? faded : normal);
  }
}

/**
 * The box around a geometry.
 *
 * Returns
 * -------
 * list
 *     ``[[west, south], [east, north]]``.
 */
export function boundsOfGeometry(geometry: { type: string; coordinates: unknown }): [[number, number], [number, number]] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  const visit = (node: unknown): void => {
    if (Array.isArray(node) && typeof node[0] === "number") {
      const [lon, lat] = node as number[];
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    }
  };
  visit(geometry.coordinates);
  return [
    [west, south],
    [east, north],
  ];
}
