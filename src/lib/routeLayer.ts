/**
 * Drawing of the planned route on the map.
 *
 * Segments that follow paths are drawn as a solid line. Segments where no
 * path was found (straight lines) are dashed, so the user sees right away
 * where the route is not reliable.
 *
 * Stages (days) are told apart by hatching: the first stage is a plain line,
 * the second has hatch marks leaning one way, the third the other way, and
 * the pattern starts again for the fourth.
 */

import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

type RouteData = Parameters<GeoJSONSource["setData"]>[0];

const SOURCE_ID = "hike-route";
const ROUTE_COLOR = "#D6246E";
const COLORED_LINE_LAYERS = ["hike-route-snapped", "hike-route-free"];
/** Hatch layers: the stage styles 1 and 2, with their hatch image. */
const HATCHES = [
  { style: 1, image: "route-hatch-up" },
  { style: 2, image: "route-hatch-down" },
];

/**
 * Draw a short diagonal stroke, used as a hatch mark along the route.
 *
 * It is a "signed distance field" image, which MapLibre can recolour, so the
 * hatches take the colour of the parcours.
 *
 * Parameters
 * ----------
 * leansRight : bool
 *     True for "/", false for "\\".
 *
 * Returns
 * -------
 * ImageData
 *     The image, white on a transparent background.
 */
function hatchImage(leansRight: boolean): ImageData {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.lineWidth = 4;
  context.lineCap = "round";
  context.strokeStyle = "#FFFFFF";
  context.beginPath();
  if (leansRight) {
    context.moveTo(6, 26);
    context.lineTo(26, 6);
  } else {
    context.moveTo(6, 6);
    context.lineTo(26, 26);
  }
  context.stroke();
  return context.getImageData(0, 0, size, size);
}

/**
 * Add the route source and layers to a map. Call once the style is loaded.
 *
 * Parameters
 * ----------
 * map : Map
 *     The map to draw on.
 */
export function addRouteLayers(map: MapLibreMap): void {
  map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  const layout = { "line-cap": "round", "line-join": "round" } as const;
  map.addLayer({
    id: "hike-route-casing",
    type: "line",
    source: SOURCE_ID,
    layout,
    paint: { "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "hike-route-snapped",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "snapped"], true],
    layout,
    paint: { "line-color": ROUTE_COLOR, "line-width": 4.5 },
  });
  map.addLayer({
    id: "hike-route-free",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "snapped"], false],
    layout: { "line-join": "round" },
    // Dashed and paler while the real route is still being computed.
    paint: {
      "line-color": ROUTE_COLOR,
      "line-width": 4,
      "line-dasharray": [1.5, 1.5],
      "line-opacity": ["case", ["get", "pending"], 0.55, 1] as ExpressionSpecification,
    },
  });

  // Hatch marks along the stages that are not the first (see the top of this file).
  map.addImage("route-hatch-up", hatchImage(true), { sdf: true, pixelRatio: 2 });
  map.addImage("route-hatch-down", hatchImage(false), { sdf: true, pixelRatio: 2 });
  for (const { style, image } of HATCHES) {
    map.addLayer({
      id: `hike-route-hatch-${style}`,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["==", ["get", "style"], style],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 11,
        "icon-image": image,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
      },
      paint: { "icon-color": ROUTE_COLOR },
    });
  }
}

/**
 * Change the colour of the route (each parcours has its own).
 *
 * Parameters
 * ----------
 * map : Map
 *     A map on which ``addRouteLayers`` was called.
 * color : str
 *     A CSS colour.
 */
export function setRouteColor(map: MapLibreMap, color: string): void {
  for (const id of COLORED_LINE_LAYERS) map.setPaintProperty(id, "line-color", color);
  for (const { style } of HATCHES) map.setPaintProperty(`hike-route-hatch-${style}`, "icon-color", color);
}

/**
 * Replace the route drawn on the map.
 *
 * Parameters
 * ----------
 * map : Map
 *     A map on which ``addRouteLayers`` was called.
 * route : object
 *     A GeoJSON ``FeatureCollection`` of ``LineString`` features, each with a
 *     boolean ``snapped`` property.
 */
export function updateRoute(map: MapLibreMap, route: RouteData): void {
  (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(route);
}
