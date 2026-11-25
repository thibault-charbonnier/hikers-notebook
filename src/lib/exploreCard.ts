/**
 * The small card shown when the home map is clicked on something of the
 * Explorer: a summit or pass (name and altitude), or "what is here" (GR trails,
 * regional park, massif).
 *
 * When the person has given a home address, a summit, a massif and a park also
 * get the time by car from home (worked out by the IGN service while the card
 * is already on screen; to the nearest road for a summit or the middle of a
 * massif). A trail gets none: it is a route, not a place.
 *
 * Built with DOM calls (never from data as HTML), so a name from the data files
 * cannot inject markup.
 */

import type { LngLat, LngLatLike, Map as MapLibreMap, MapGeoJSONFeature, PointLike } from "maplibre-gl";

/** Position of a point feature. */
const positionOf = (feature: MapGeoJSONFeature): [number, number] => (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;
import { driveBetween, formatDuration, type HomeAddress } from "./drive";
import { PEAK_DOT_LAYERS, PEAK_KIND } from "./exploreLayers";
import { connection } from "./online.svelte.js";
import { CAR_MARKUP } from "./parcoursCard";

export interface ExploreCard {
  /** Where the card is anchored. */
  lngLat: LngLatLike;
  /** The card, ready to be put in a popup. */
  content: HTMLElement;
}

/** Create an element with a class and some text. */
function element(tag: string, className: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** One line of the card: a small kind, then a name, then an optional detail. */
function row(kind: string, title: string, detail = ""): HTMLElement {
  const line = element("div", "explore-row");
  line.append(element("span", "explore-kind", kind), element("strong", "", title));
  if (detail) line.append(element("span", "explore-detail", detail));
  return line;
}

/**
 * A line "by car, about 2 h 10" for a place, filled in once the service has answered.
 * Nothing is added if there is no home address, no network, or no answer.
 */
function driveLine(home: HomeAddress | null, place: [number, number]): HTMLElement | null {
  if (!home || !connection.online) return null;
  const line = element("div", "explore-drive");
  const car = element("span", "card-icon");
  car.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAR_MARKUP}</svg>`;
  const text = element("span", "", "calcul…");
  line.append(car, text);
  driveBetween([home.lon, home.lat], place).then((result) => {
    if (!result) return line.remove();
    text.textContent = `≈ ${formatDuration(result.minutes)} en voiture`;
    line.title = `${result.km.toLocaleString("fr-FR")} km depuis ton domicile, jusqu'à la route la plus proche (sans circulation)`;
  });
  return line;
}

/** The query box around a point (so thin lines and dots are easy to hit). */
function around(point: PointLike, radius: number): [PointLike, PointLike] {
  const { x, y } = point as { x: number; y: number };
  return [
    [x - radius, y - radius],
    [x + radius, y + radius],
  ];
}

/** Distinct values, in order. */
const distinct = <T>(values: T[]): T[] => [...new Set(values)];

/**
 * Build the card for a click on the home map, if the click is on anything of the Explorer.
 *
 * Parameters
 * ----------
 * map : Map
 *     The home map.
 * point : Point
 *     Where the map was clicked, in pixels.
 * clicked : LngLat
 *     The same place, as a position.
 * home : HomeAddress or null
 *     The person's home, to show the time by car (nothing is shown without it).
 *
 * Returns
 * -------
 * ExploreCard or null
 *     The card and where to anchor it, or ``null`` if there is nothing there.
 */
export function exploreCardAt(map: MapLibreMap, point: PointLike, clicked: LngLat, home: HomeAddress | null = null): ExploreCard | null {
  // A summit or a pass: the nearest dot, the most important one first when they touch.
  const dots = map.queryRenderedFeatures(around(point, 9), { layers: PEAK_DOT_LAYERS });
  if (dots.length > 0) {
    const { x, y } = point as { x: number; y: number };
    const distance = (feature: MapGeoJSONFeature): number => {
      const pixel = map.project(positionOf(feature));
      return Math.hypot(pixel.x - x, pixel.y - y);
    };
    const best = [...dots].sort((a, b) => distance(a) - distance(b) || a.properties.importance - b.properties.importance)[0];
    const { name, type, ele } = best.properties;
    const [lng, lat] = positionOf(best);
    const card = element("div", "explore-card");
    card.append(row(PEAK_KIND[type] ?? "Repère", name, typeof ele === "number" ? `${ele.toLocaleString("fr-FR")} m` : ""));
    const drive = driveLine(home, [lng, lat]);
    if (drive) card.append(drive);
    return { lngLat: [lng, lat], content: card };
  }

  // What is here: trails, park, massif, region.
  const rows: HTMLElement[] = [];
  const trails = map.queryRenderedFeatures(around(point, 6), { layers: ["explore-gr-line"] });
  for (const ref of distinct(trails.map((f) => f.properties.ref as string)).slice(0, 4)) {
    const name = trails.find((f) => f.properties.ref === ref)?.properties.name as string;
    rows.push(row("Sentier", ref, name && name !== ref ? name : ""));
  }
  for (const feature of map.queryRenderedFeatures(point, { layers: ["explore-parks-fill"] }).slice(0, 1)) {
    rows.push(row("Parc naturel", feature.properties.name));
    const drive = driveLine(home, [feature.properties.cx, feature.properties.cy]);
    if (drive) rows.push(drive);
  }
  const massif = map.queryRenderedFeatures(point, { layers: ["explore-massifs-fill"] })[0];
  if (massif) {
    rows.push(row("Massif", massif.properties.name, massif.properties.zone ?? ""));
    const drive = driveLine(home, [massif.properties.cx, massif.properties.cy]);
    if (drive) rows.push(drive);
  }
  if (rows.length === 0) return null;

  const card = element("div", "explore-card");
  card.append(...rows);
  return { lngLat: clicked, content: card };
}
