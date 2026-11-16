/**
 * What is saved for a "parcours" (a planned or completed hike), and how.
 *
 * Lightness is the main constraint, so the file keeps only what cannot be
 * recomputed cheaply:
 *
 * - the points placed by the user (with their notes);
 * - for each stretch between two points, the route geometry and the elevation
 *   samples, both as compact text (see ``polyline.ts``), so opening a parcours
 *   needs no network and no recomputation;
 * - the figures of the whole parcours;
 * - a ``preview``: the whole route, strongly simplified, for the overview map
 *   (and later for thumbnails). It is a few hundred positions at most.
 *
 * A 20 km parcours takes roughly 6 to 10 kB.
 */

import { simplifyLine } from "./geo";
import type { LngLat, Segment, Stats } from "./geo";
import type { StoredPoi } from "./poi";
import { decodeDeltas, decodePolyline, encodeDeltas, encodePolyline } from "./polyline";

export type ParcoursType = "marche" | "randonnee" | "trek";

/** How a type of parcours looks on the overview map. */
export interface ParcoursTypeInfo {
  id: ParcoursType;
  label: string;
  /** Dash pattern, in line widths, or ``null`` for a solid line. */
  dash: number[] | null;
  width: number;
}

/** The types, with the line style that tells them apart on the overview map. */
export const PARCOURS_TYPES: ParcoursTypeInfo[] = [
  { id: "marche", label: "Marche", dash: [0.1, 2.2], width: 4 },
  { id: "randonnee", label: "Randonnée", dash: [2.5, 1.5], width: 4 },
  { id: "trek", label: "Trek", dash: null, width: 5 },
];

/** Colours given to parcours, one each, in this order (distinct on the map). */
export const PARCOURS_COLORS = [
  "#1F6FEB",
  "#D6246E",
  "#E07B00",
  "#7B3FC4",
  "#0E9F6E",
  "#C0392B",
  "#00A3A3",
  "#8C6D1F",
  "#3B4A9C",
  "#E64FA0",
];

/** Number of different line styles given to stages in turn (solid, hatched one way, hatched the other way). */
export const STAGE_PATTERN_COUNT = 3;

/** Basic colours offered for parcours and labels (any other colour can be picked too). */
export const BASIC_COLORS = [
  "#E53935",
  "#F57C00",
  "#FBC02D",
  "#43A047",
  "#00897B",
  "#1E88E5",
  "#3949AB",
  "#8E24AA",
  "#D81B60",
  "#6D4C41",
  "#546E7A",
  "#212121",
];

/** A label that can be put on parcours (a tag with a colour). */
export interface Label {
  name: string;
  color: string;
}

export interface StoredWaypoint {
  lon: number;
  lat: number;
  name?: string;
  description?: string;
  /** Present (and true) if this point ends a stage. */
  stage?: true;
}

export interface StoredSegment {
  geometry: string;
  snapped: boolean;
  /** Length in meters, with one decimal. */
  length: number;
  /** Elevation samples in tenths of a meter, or ``null`` if unavailable. */
  elevation: string | null;
}

export interface ParcoursFile {
  version: 1;
  id: string;
  name: string;
  description: string;
  type: ParcoursType;
  done: boolean;
  /** Date of completion, ``YYYY-MM-DD``. */
  doneOn: string | null;
  doneComment: string;
  /** Rating from 0.5 to 5 stars, in steps of 0.5, or ``null``. Files saved before it existed lack it. */
  rating?: number | null;
  /** Names of the labels (see ``Label``). */
  labels: string[];
  color: string;
  /** Number of stages (at least 1). Files saved before stages existed lack it. */
  stages?: number;
  createdAt: string;
  updatedAt: string;
  stats: Stats;
  /** Whole route, simplified, as an encoded polyline. */
  preview: string;
  closed: boolean;
  /** The points placed by the user. For a loop, the closing point is not stored. */
  waypoints: StoredWaypoint[];
  segments: StoredSegment[];
  /** Points of interest and comments. Files saved before they existed lack it. */
  pois?: StoredPoi[];
}

/** A parcours without its heavy parts: enough for lists and the overview map. */
export type ParcoursSummary = Omit<ParcoursFile, "waypoints" | "segments" | "pois">;

/** Elevation is stored in tenths of a meter. */
const ELEVATION_UNIT = 10;
const PREVIEW_TOLERANCE_M = 25;
const MAX_PREVIEW_POSITIONS = 400;

/**
 * Turn a segment into its compact stored form.
 *
 * Parameters
 * ----------
 * segment : Segment
 *     A fully computed segment.
 *
 * Returns
 * -------
 * StoredSegment
 *     The segment as text and a few numbers.
 */
export function encodeSegment(segment: Segment): StoredSegment {
  return {
    geometry: encodePolyline(segment.coordinates),
    snapped: segment.snapped,
    length: Math.round(segment.length * 10) / 10,
    elevation: segment.elevation
      ? encodeDeltas(segment.elevation.map((e) => Math.round(e * ELEVATION_UNIT)))
      : null,
  };
}

/**
 * Rebuild a segment from its stored form.
 *
 * Elevation samples are evenly spaced along the segment, so their distances
 * are recomputed from the length instead of being stored.
 *
 * Parameters
 * ----------
 * stored : StoredSegment
 *     A segment read from a file.
 *
 * Returns
 * -------
 * Segment
 *     The segment, as the app uses it.
 */
export function decodeSegment(stored: StoredSegment): Segment {
  const elevation =
    stored.elevation === null ? null : decodeDeltas(stored.elevation).map((v) => v / ELEVATION_UNIT);
  const last = elevation ? elevation.length - 1 : 1;
  const distance = last === 0 ? [0] : Array.from({ length: last + 1 }, (_, k) => (stored.length * k) / last);
  return {
    coordinates: decodePolyline(stored.geometry),
    snapped: stored.snapped,
    length: stored.length,
    distance,
    elevation,
  };
}

/**
 * Build the simplified whole route kept for the overview map.
 *
 * The tolerance grows until the result has at most a few hundred positions.
 *
 * Parameters
 * ----------
 * segments : list of Segment
 *     The segments of the parcours, in order.
 *
 * Returns
 * -------
 * str
 *     The simplified route as an encoded polyline.
 */
export function buildPreview(segments: Segment[]): string {
  const line: LngLat[] = [];
  segments.forEach((segment, i) => {
    for (const position of i === 0 ? segment.coordinates : segment.coordinates.slice(1)) line.push(position);
  });
  let tolerance = PREVIEW_TOLERANCE_M;
  let simple = simplifyLine(line, tolerance);
  while (simple.length > MAX_PREVIEW_POSITIONS) {
    tolerance *= 2;
    simple = simplifyLine(line, tolerance);
  }
  return encodePolyline(simple);
}
