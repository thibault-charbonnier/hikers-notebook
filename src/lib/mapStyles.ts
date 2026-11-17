/**
 * Map styles used by the app.
 *
 * Two maps, two sources:
 *
 * - the home map is a light, fast world map built here from OpenFreeMap
 *   (OpenStreetMap data), with everything outside France dimmed;
 * - the planning map uses the official "Plan IGN" vector style, which already
 *   contains contour lines and hiking paths.
 */

import { AERIAL_TILES } from "./mapLayers";
import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";

/** Official IGN style (BD TOPO): contour lines, paths, relief. No API key. */
export const IGN_STYLE_URL =
  "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json";

/** Deepest zoom of the Plan IGN tiles the app asks for (deeper views enlarge these tiles). */
const PLAN_IGN_MAX_TILE_ZOOM = 16;

/**
 * Change the Plan IGN style as it is loaded, so the map never asks for tiles
 * deeper than zoom 16.
 *
 * These are vector tiles (drawings), so a zoom-16 tile stays sharp when the
 * view goes further in, and there is almost nothing more in zoom 17 and 18.
 * Stopping at 16 lets the offline download save a few hundred tiles instead
 * of a few thousand. The address of the tiles is kept; the separate "TileJSON"
 * file of the source is dropped, because it would put the limit back to 18.
 *
 * Use it with ``map.setStyle(IGN_STYLE_URL, { transformStyle: capPlanIgnZoom })``.
 *
 * Parameters
 * ----------
 * _previous : StyleSpecification or undefined
 *     The style being replaced (unused).
 * next : StyleSpecification
 *     The style that has just been downloaded.
 *
 * Returns
 * -------
 * StyleSpecification
 *     The style to use.
 */
export function capPlanIgnZoom(_previous: StyleSpecification | undefined, next: StyleSpecification): StyleSpecification {
  const source = next.sources["plan_ign"];
  if (source && source.type === "vector") {
    const { url, ...rest } = source;
    next.sources["plan_ign"] = { ...rest, minzoom: 0, maxzoom: PLAN_IGN_MAX_TILE_ZOOM };
  }
  return next;
}

/**
 * Style of the aerial photos of the IGN: one picture layer, no labels. Like the
 * Plan IGN style it gets the France mask, the route and the overlays added on
 * top once it has loaded (see PlanView.svelte).
 *
 * Returns
 * -------
 * StyleSpecification
 *     A MapLibre style object.
 */
export function aerialStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      aerial: {
        type: "raster",
        tiles: [AERIAL_TILES],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
      },
    },
    layers: [{ id: "aerial", type: "raster", source: "aerial" }],
  };
}

/** Credit line the Plan IGN style does not declare by itself. */
export const IGN_ATTRIBUTION = '<a href="https://geoservices.ign.fr">© IGN</a>';

// Palette taken from the design mock-up.
const COLOR = {
  land: "#F1EEE3",
  water: "#BCD0DA",
  wood: "#D9E3CF",
  border: "#8A8F8B",
  road: "#C9B58A",
  accent: "#2F5D46",
  text: "#1F2A24",
  dim: "#2B312D",
};

/**
 * Address of the "world without France" polygon (see
 * ``tools/build_france_mask.py``). It must be absolute: MapLibre fetches it
 * from a worker, which cannot resolve relative paths.
 */
export function franceMaskUrl(): string {
  return new URL("data/france-mask.geojson", document.baseURI).href;
}

/** Data source of the France mask. */
function maskSource(): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data: franceMaskUrl(),
    attribution: "Contour de la France : IGN Admin Express",
  };
}

/** Layers that dim everything outside France and outline France. */
const MASK_LAYERS: LayerSpecification[] = [
  {
    id: "outside-france",
    type: "fill",
    source: "mask",
    paint: { "fill-color": COLOR.dim, "fill-opacity": 0.5 },
  },
  {
    id: "france-glow",
    type: "line",
    source: "mask",
    paint: { "line-color": COLOR.accent, "line-width": 6, "line-opacity": 0.3, "line-blur": 4 },
  },
  {
    id: "france-edge",
    type: "line",
    source: "mask",
    paint: { "line-color": COLOR.accent, "line-width": 1.5 },
  },
];

/**
 * Dim everything outside France on an existing map.
 *
 * Used on the planning map: the Plan IGN only has detailed data (paths,
 * contour lines) inside France, so the rest is greyed out like on the home
 * map. Call it once the style is loaded.
 *
 * Parameters
 * ----------
 * map : Map
 *     The map to modify.
 */
export function addFranceMask(map: MapLibreMap): void {
  map.addSource("mask", maskSource());
  for (const layer of MASK_LAYERS) map.addLayer(layer);
}

/**
 * Build the style of the home map.
 *
 * Layers are listed bottom to top: ground, water, borders and roads, then a
 * dark veil over everything that is not France, then the labels.
 *
 * Returns
 * -------
 * StyleSpecification
 *     A MapLibre style object.
 */
export function homeStyle(): StyleSpecification {
  const placeName = ["coalesce", ["get", "name:fr"], ["get", "name:en"], ["get", "name"]];

  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      relief: {
        type: "raster",
        tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 6,
        attribution: "Natural Earth",
      },
      mask: maskSource(),
    },
    layers: [
      { id: "ground", type: "background", paint: { "background-color": COLOR.land } },
      {
        id: "relief",
        type: "raster",
        source: "relief",
        paint: { "raster-opacity": 0.45, "raster-saturation": -0.6 },
      },
      {
        id: "woods",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        minzoom: 5,
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-color": COLOR.wood, "fill-opacity": 0.8 },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": COLOR.water },
      },
      {
        id: "borders",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": COLOR.border, "line-width": 0.8 },
      },
      {
        id: "main-roads",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 5,
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
        paint: {
          "line-color": COLOR.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 9, 1.6],
        },
      },
      ...MASK_LAYERS,
      {
        id: "country-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        maxzoom: 6,
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": placeName as never,
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 11, 6, 16],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: { "text-color": "#F4F1E8", "text-halo-color": "rgba(31,42,36,0.6)", "text-halo-width": 1.2 },
      },
      {
        id: "city-labels",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        minzoom: 4,
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        layout: {
          "text-field": placeName as never,
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 9, 14],
          "symbol-sort-key": ["get", "rank"],
        },
        paint: { "text-color": COLOR.text, "text-halo-color": "rgba(244,241,232,0.9)", "text-halo-width": 1.5 },
      },
    ],
  };
}
