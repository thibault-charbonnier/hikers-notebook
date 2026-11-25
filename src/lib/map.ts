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
  type ControlPosition,
  type FitBoundsOptions,
  type MapOptions,
  type Popup,
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

/** Free space a popup must keep around it, in pixels, measured from the edges of the map. */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Pan the map just enough for a popup to be entirely visible.
 *
 * A popup is anchored to a spot of the map and, unlike the rest of the page,
 * nothing keeps it inside the screen: next to an edge (or under the bars that
 * float over the map) part of it would be cut off. Moving the map a little
 * brings it back, and the popup follows since it is attached to the map.
 *
 * Parameters
 * ----------
 * map : Map
 *     The map the popup belongs to.
 * popup : Popup
 *     A popup that has just been added to the map.
 * insets : Insets
 *     Space to keep free on each side (for instance the height of a bar).
 */
export function keepPopupInView(map: MapLibreMap, popup: Popup, insets: Insets): void {
  // Wait one frame: the popup has no size before the browser has laid it out.
  requestAnimationFrame(() => {
    const box = popup.getElement()?.querySelector(".maplibregl-popup-content") ?? popup.getElement();
    if (!box) return;
    const popupRect = box.getBoundingClientRect();
    const mapRect = map.getContainer().getBoundingClientRect();

    const minLeft = mapRect.left + insets.left;
    const maxRight = mapRect.right - insets.right;
    const minTop = mapRect.top + insets.top;
    const maxBottom = mapRect.bottom - insets.bottom;

    // Panning the map by +x moves what is shown towards the left, hence the signs.
    let dx = 0;
    if (popupRect.left < minLeft) dx = popupRect.left - minLeft;
    else if (popupRect.right > maxRight) dx = popupRect.right - maxRight;
    let dy = 0;
    if (popupRect.top < minTop) dy = popupRect.top - minTop;
    else if (popupRect.bottom > maxBottom) dy = popupRect.bottom - maxBottom;

    if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 250 });
  });
}

/** Insets that keep a popup clear of the floating bars of the planning page. */
export function planPopupInsets(): Insets {
  const phone = matchMedia("(max-width: 720px)").matches;
  return phone ? { top: 190, bottom: 110, left: 8, right: 8 } : { top: 16, bottom: 56, left: 76, right: 16 };
}

/** Degrees the map turns per pixel of a right-click drag (MapLibre's own is 0.8, which is far too much). */
const DEGREES_PER_PIXEL = 0.2;
/** A right-click that moves less than this many pixels is a plain click (it places a point on the planning map). */
const DRAG_THRESHOLD = 4;

/**
 * Turn the map with a right-click drag, gently.
 *
 * MapLibre's own right-click drag turns the map 0.8 degrees per pixel, so a
 * small gesture makes a full circle. This one turns it 0.2 degrees per pixel. It
 * fires the same ``rotatestart`` / ``rotate`` / ``rotateend`` events, so the
 * rest of the app does not notice the difference. The browser's right-click menu
 * is never shown on a map.
 *
 * Parameters
 * ----------
 * map : Map
 *     The map.
 * container : HTMLElement
 *     The element it is drawn into.
 */
function enableGentleRotation(map: MapLibreMap, container: HTMLElement): void {
  let start: { x: number; bearing: number } | null = null;
  let turning = false;

  const onDown = (event: MouseEvent): void => {
    if (event.button === 2) start = { x: event.clientX, bearing: map.getBearing() };
  };
  const onMove = (event: MouseEvent): void => {
    if (!start) return;
    const moved = event.clientX - start.x;
    if (!turning && Math.abs(moved) < DRAG_THRESHOLD) return;
    if (!turning) {
      turning = true;
      map.fire("rotatestart", { originalEvent: event });
    }
    map.setBearing(start.bearing + moved * DEGREES_PER_PIXEL);
  };
  const onUp = (event: MouseEvent): void => {
    if (event.button !== 2 || !start) return;
    start = null;
    if (turning) {
      turning = false;
      map.fire("rotateend", { originalEvent: event });
    }
  };
  const noMenu = (event: Event): void => event.preventDefault();

  container.addEventListener("mousedown", onDown);
  container.addEventListener("contextmenu", noMenu);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  map.once("remove", () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  });
}

/**
 * Create a map framed on France, without tilt, with zoom buttons.
 *
 * Tilt is disabled (not needed for planning; the 3D view turns it on). Turning
 * the map is allowed: two fingers on a phone, right-click drag with a mouse
 * (see ``enableGentleRotation`` and MapCompass.svelte). The zoom-out limit follows the
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
 * zoomButtons : str or null
 *     Corner where the "+" and "-" buttons sit, or ``null`` for no buttons.
 *
 * Returns
 * -------
 * Map
 *     The new map. Call ``map.remove()`` when it is no longer used.
 */
export function createMap(
  container: HTMLElement,
  options: Omit<MapOptions, "container">,
  zoomButtons: ControlPosition | null = "top-right",
): MapLibreMap {
  const map = new MapLibreMap({
    dragRotate: false, // the right-click drag that turns the map is our own, gentler one (see enableGentleRotation)
    pitchWithRotate: false,
    touchPitch: false,
    bounds: FRANCE_BOUNDS,
    fitBoundsOptions: { padding: 24 },
    maxBounds: FRANCE_MAX_BOUNDS,
    ...options,
    container,
  });
  // Two fingers zoom AND turn the map (on a phone); the compass puts north back on top.
  enableGentleRotation(map, container);
  if (zoomButtons) map.addControl(new NavigationControl({ showCompass: false }), zoomButtons);

  const updateMinZoom = () => {
    const { clientWidth, clientHeight } = container;
    // A map that is hidden or being removed has no size: nothing to compute.
    if (clientWidth === 0 || clientHeight === 0) return;
    // MapLibre refuses a limit outside of what it can show.
    const cover = zoomToCover(FRANCE_MAX_BOUNDS, clientWidth, clientHeight);
    map.setMinZoom(Math.min(Math.max(cover, -2), map.getMaxZoom()));
  };
  updateMinZoom();
  map.on("resize", updateMinZoom);

  // When the map is narrow (a phone, or a wide side menu) MapLibre switches the
  // credits to their compact form, but leaves them unfolded. They are folded
  // behind their "i" button instead (still one tap away), so they do not hide
  // the buttons on the map: at the start if the map is already narrow, and
  // each time it becomes narrow.
  const foldCredits = () => {
    for (const credits of container.querySelectorAll(".maplibregl-ctrl-attrib")) {
      credits.removeAttribute("open");
      credits.classList.remove("maplibregl-compact-show");
    }
  };
  let wasNarrow = false;
  const checkNarrow = () => {
    const narrow = container.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact") !== null;
    if (narrow && !wasNarrow) foldCredits();
    wasNarrow = narrow;
  };
  map.once("load", () => {
    wasNarrow = false; // the credits did not exist yet during earlier resizes
    checkNarrow();
  });
  map.on("resize", checkNarrow);

  return map;
}
