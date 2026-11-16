/**
 * Shared helper to create a MapLibre map with the same behaviour everywhere.
 *
 * Both maps (overview and planning) are framed on France in the same way:
 * same starting view, same pan limits, same zoom-out limit. They only differ
 * by their style and by how far they can zoom in.
 */

import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type FitBoundsOptions,
  type MapOptions,
} from "maplibre-gl";
// Importing the worker with `?worker&url` makes Vite treat it as a web worker
// and gives us its address, in development and in the built site alike
// (MapLibre cannot find its worker by itself once the app is bundled).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);

type Bounds = [[number, number], [number, number]];

/** Bounding box of metropolitan France: ``[[west, south], [east, north]]``. */
const FRANCE_BOUNDS: Bounds = [
  [-5.5, 41.2],
  [9.8, 51.2],
];

/**
 * Limit for panning and zooming out: France plus a margin of a few degrees,
 * so neighbouring countries stay visible but the user cannot wander to places
 * the Plan IGN has no detail for.
 */
const FRANCE_MAX_BOUNDS: Bounds = [
  [-10, 37.5],
  [14, 54.5],
];

/** Size in pixels of the whole world at zoom 0 (MapLibre uses 512 px tiles). */
const WORLD_SIZE_AT_ZOOM_0 = 512;

/**
 * Compute the zoom level at which ``bounds`` just fill a viewport.
 *
 * Below this zoom, the viewport would show space outside the bounds.
 *
 * Parameters
 * ----------
 * bounds : list
 *     ``[[west, south], [east, north]]`` in degrees.
 * width, height : float
 *     Viewport size in pixels.
 *
 * Returns
 * -------
 * float
 *     The zoom level that makes the bounds cover the whole viewport.
 */
function zoomToCover(bounds: Bounds, width: number, height: number): number {
  const [[west, south], [east, north]] = bounds;
  // Web Mercator: x is linear in longitude, y is not linear in latitude.
  const mercatorY = (lat: number) =>
    (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  const widthFraction = (east - west) / 360;
  const heightFraction = mercatorY(south) - mercatorY(north);
  const zoomForWidth = Math.log2(width / (WORLD_SIZE_AT_ZOOM_0 * widthFraction));
  const zoomForHeight = Math.log2(height / (WORLD_SIZE_AT_ZOOM_0 * heightFraction));
  return Math.max(zoomForWidth, zoomForHeight);
}

/**
 * Zoom the map on an area, with an animation, and wait until it is settled.
 *
 * When a side bar slides in or out while the map is being created, MapLibre
 * can keep drawing with the old width: the route looks stretched and no longer
 * matches the markers. A clean resize at the end of the animation fixes it.
 * Callers can wait for the returned promise before showing anything that
 * must line up with the map (such as markers).
 *
 * Parameters
 * ----------
 * map : Map
 *     The map to move.
 * bounds : list
 *     The area to show, ``[[west, south], [east, north]]``.
 * options : FitBoundsOptions
 *     Padding, maximum zoom, duration, etc.
 *
 * Returns
 * -------
 * Promise
 *     Resolved once the animation is over and the map has been resized.
 */
export function fitBoundsAndSettle(map: MapLibreMap, bounds: Bounds, options: FitBoundsOptions): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.resize();
      requestAnimationFrame(() => resolve());
    };
    map.once("moveend", finish);
    // Safety net: some moves end without a "moveend" (nothing to move).
    setTimeout(finish, (options.duration ?? 1500) + 600);
    map.fitBounds(bounds, options);
  });
}

/**
 * Create a map framed on France, without rotation or tilt, with zoom buttons.
 *
 * Rotation and tilt are disabled because they are not needed for planning
 * and make touch gestures harder on a phone. The zoom-out limit follows the
 * window size, so the "-" button greys out exactly when the limit is reached.
 *
 * Parameters
 * ----------
 * container : HTMLElement
 *     The element the map is drawn into.
 * options : MapOptions
 *     Options forwarded to ``maplibregl.Map`` (at least ``style``; usually
 *     ``maxZoom``). The framing options and ``container`` are filled in by
 *     this function.
 *
 * Returns
 * -------
 * Map
 *     The new map. Call ``map.remove()`` when it is no longer used.
 */
export function createMap(
  container: HTMLElement,
  options: Omit<MapOptions, "container">,
): MapLibreMap {
  const map = new MapLibreMap({
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    bounds: FRANCE_BOUNDS,
    fitBoundsOptions: { padding: 24 },
    maxBounds: FRANCE_MAX_BOUNDS,
    ...options,
    container,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");

  const updateMinZoom = () => {
    const { clientWidth, clientHeight } = container;
    map.setMinZoom(zoomToCover(FRANCE_MAX_BOUNDS, clientWidth, clientHeight));
  };
  updateMinZoom();
  map.on("resize", updateMinZoom);

  // On a narrow screen the map credits start folded behind their "i" button
  // (they are still one tap away), so they do not hide the buttons on the map.
  map.once("load", () => {
    if (container.clientWidth >= 640) return;
    for (const credits of container.querySelectorAll(".maplibregl-ctrl-attrib")) {
      credits.removeAttribute("open");
      credits.classList.remove("maplibregl-compact-show");
    }
  });

  return map;
}
