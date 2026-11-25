/**
 * Saved parcours drawn on the overview map.
 *
 * Each parcours has its own colour, so crossing routes stay readable, and a
 * line style that tells its type apart (dots, dashes, solid). Only the
 * simplified ``preview`` of each parcours is drawn: the overview map has no
 * paths to follow, and a rough line is enough there.
 */

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { PARCOURS_TYPES } from "./parcours";
import type { ParcoursSummary } from "./parcours";
import { decodePolyline } from "./polyline";
import type { LngLat } from "./geo";

const LINES_SOURCE = "parcours-lines";
const STARTS_SOURCE = "parcours-starts";
/** Wide, almost invisible layer that makes thin lines easy to hover and click. */
export const HIT_LAYER = "parcours-hit";

/** The simplified route of a parcours, decoded (and remembered). */
const decoded = new WeakMap<ParcoursSummary, LngLat[]>();
export function routeOf(item: ParcoursSummary): LngLat[] {
  let line = decoded.get(item);
  if (!line) {
    line = decodePolyline(item.preview);
    decoded.set(item, line);
  }
  return line;
}

/**
 * Add the sources and layers for the saved parcours. Call once the style is loaded.
 *
 * Parameters
 * ----------
 * map : Map
 *     The overview map.
 */
export function addParcoursLayers(map: MapLibreMap): void {
  const empty = { type: "FeatureCollection", features: [] } as const;
  map.addSource(LINES_SOURCE, { type: "geojson", data: empty });
  map.addSource(STARTS_SOURCE, { type: "geojson", data: empty });

  const layout = { "line-cap": "round", "line-join": "round" } as const;
  map.addLayer({
    id: "parcours-casing",
    type: "line",
    source: LINES_SOURCE,
    layout,
    paint: { "line-color": "#FFFFFF", "line-width": 7, "line-opacity": 0.85 },
  });
  for (const info of PARCOURS_TYPES) {
    map.addLayer({
      id: `parcours-${info.id}`,
      type: "line",
      source: LINES_SOURCE,
      filter: ["==", ["get", "type"], info.id],
      layout,
      paint: {
        "line-color": ["get", "color"],
        "line-width": info.width,
        ...(info.dash && { "line-dasharray": info.dash }),
      },
    });
  }
  map.addLayer({
    id: "parcours-starts",
    type: "circle",
    source: STARTS_SOURCE,
    paint: {
      "circle-radius": 5,
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: HIT_LAYER,
    type: "line",
    source: LINES_SOURCE,
    layout,
    paint: { "line-color": "#000000", "line-width": 18, "line-opacity": 0.01 },
  });
}

/**
 * Replace the parcours drawn on the map.
 *
 * Parameters
 * ----------
 * map : Map
 *     A map on which ``addParcoursLayers`` was called.
 * items : list of ParcoursSummary
 *     The parcours to draw.
 */
export function updateParcours(map: MapLibreMap, items: ParcoursSummary[]): void {
  const withLine = items.filter((item) => routeOf(item).length >= 2);
  const properties = (item: ParcoursSummary) => ({ id: item.id, name: item.name, color: item.color, type: item.type });

  (map.getSource(LINES_SOURCE) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: withLine.map((item) => ({
      type: "Feature",
      properties: properties(item),
      geometry: { type: "LineString", coordinates: routeOf(item) },
    })),
  });
  (map.getSource(STARTS_SOURCE) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: withLine.map((item) => ({
      type: "Feature",
      properties: properties(item),
      geometry: { type: "Point", coordinates: routeOf(item)[0] },
    })),
  });
}

/**
 * Show or hide every layer of the saved parcours (the Explorer window has a switch for them).
 *
 * Parameters
 * ----------
 * map : Map
 *     A map on which ``addParcoursLayers`` was called.
 * visible : bool
 *     True to show them, false to hide them.
 */
export function setParcoursVisible(map: MapLibreMap, visible: boolean): void {
  const ids = ["parcours-casing", ...PARCOURS_TYPES.map((info) => `parcours-${info.id}`), "parcours-starts", HIT_LAYER];
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/**
 * Compute the bounding box of a parcours.
 *
 * Parameters
 * ----------
 * item : ParcoursSummary
 *     A saved parcours.
 *
 * Returns
 * -------
 * list
 *     ``[[west, south], [east, north]]``.
 */
export function boundsOf(item: ParcoursSummary): [LngLat, LngLat] {
  const line = routeOf(item);
  const lons = line.map(([lon]) => lon);
  const lats = line.map(([, lat]) => lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
