/**
 * Geometry helpers: distances, resampling, elevation profile and ascent.
 *
 * Everything here is a pure function (no network, no map), so it is easy to
 * read and to test.
 */

/** A position as ``[longitude, latitude]`` in degrees. */
export type LngLat = [number, number];

/** One stretch of route between two consecutive points of a hike. */
export interface Segment {
  /** Geometry to draw. Follows the paths when ``snapped`` is true. */
  coordinates: LngLat[];
  /** False when no path was found and the segment is a straight line. */
  snapped: boolean;
  /** Length of the geometry in meters. */
  length: number;
  /** Distance from the segment start, in meters, of each elevation sample. */
  distance: number[];
  /** Elevation in meters of each sample, or ``null`` if it could not be fetched. */
  elevation: number[] | null;
}

/** Elevation along the whole hike. */
export interface Profile {
  /** Distance from the hike start, in meters, of each sample. */
  distance: number[];
  /** Elevation in meters of each sample. */
  elevation: number[];
  /** Distance from the hike start of each point placed by the user. */
  pointDistances: number[];
}

/** Figures of a whole hike. All distances and elevations are in meters. */
export interface Stats {
  distance: number;
  ascent: number;
  descent: number;
  maxElevation: number;
  minElevation: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Compute the distance between two positions (haversine formula).
 *
 * Parameters
 * ----------
 * a, b : LngLat
 *     The two positions.
 *
 * Returns
 * -------
 * float
 *     Distance in meters, along the Earth surface.
 */
export function distanceBetween(a: LngLat, b: LngLat): number {
  const toRadians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRadians;
  const dLon = (b[0] - a[0]) * toRadians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRadians) * Math.cos(b[1] * toRadians) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Compute the length of a line.
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The line, as a list of positions.
 *
 * Returns
 * -------
 * float
 *     Length in meters.
 */
export function lineLength(line: LngLat[]): number {
  let length = 0;
  for (let i = 1; i < line.length; i++) length += distanceBetween(line[i - 1], line[i]);
  return length;
}

/**
 * Resample a line into evenly spaced positions.
 *
 * The first and last positions of the line are always kept. Spacing is the
 * largest value not exceeding ``step`` that divides the line evenly.
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The line to resample (at least one position).
 * step : float
 *     Maximum spacing between samples, in meters.
 *
 * Returns
 * -------
 * object
 *     ``coordinates``: the sampled positions; ``distance``: distance in
 *     meters of each sample from the start of the line.
 */
export function resampleLine(
  line: LngLat[],
  step: number,
): { coordinates: LngLat[]; distance: number[] } {
  const cumulative = [0];
  for (let i = 1; i < line.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceBetween(line[i - 1], line[i]));
  }
  const length = cumulative[cumulative.length - 1];
  if (length === 0) return { coordinates: [line[0]], distance: [0] };

  const count = Math.ceil(length / step);
  const coordinates: LngLat[] = [];
  const distance: number[] = [];
  let index = 1; // line[index - 1] and line[index] surround the current sample
  for (let k = 0; k <= count; k++) {
    const d = (length * k) / count;
    while (index < line.length - 1 && cumulative[index] < d) index++;
    const span = cumulative[index] - cumulative[index - 1];
    const t = span === 0 ? 0 : (d - cumulative[index - 1]) / span;
    const [lon1, lat1] = line[index - 1];
    const [lon2, lat2] = line[index];
    coordinates.push([lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]);
    distance.push(d);
  }
  return { coordinates, distance };
}

/**
 * Find where a position is along the route, and how far from it.
 *
 * Parameters
 * ----------
 * segments : list of Segment
 *     The segments of the hike, in order.
 * position : LngLat
 *     The position to locate.
 *
 * Returns
 * -------
 * object
 *     ``distance``: meters from the start of the hike to the nearest vertex
 *     of the route; ``offset``: meters between the position and that vertex.
 *     ``null`` if the hike has no route.
 */
export function locateOnRoute(segments: Segment[], position: LngLat): { distance: number; offset: number } | null {
  let best: { distance: number; offset: number } | null = null;
  let before = 0;
  for (const segment of segments) {
    let along = 0;
    for (let i = 0; i < segment.coordinates.length; i++) {
      const vertex = segment.coordinates[i];
      if (i > 0) along += distanceBetween(segment.coordinates[i - 1], vertex);
      const offset = distanceBetween(position, vertex);
      if (!best || offset < best.offset) best = { distance: before + along, offset };
    }
    before += segment.length;
  }
  return best;
}

/**
 * Simplify a line by removing the positions that hardly change its shape
 * (Douglas-Peucker algorithm).
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The line to simplify.
 * tolerance : float
 *     Largest distance, in meters, between the original line and the result.
 *
 * Returns
 * -------
 * list of LngLat
 *     A line with fewer positions, keeping the first and the last.
 */
export function simplifyLine(line: LngLat[], tolerance: number): LngLat[] {
  if (line.length < 3) return line.slice();

  // Flat projection in meters: accurate enough for a few tens of kilometers.
  const kx = 111_320 * Math.cos((line[0][1] * Math.PI) / 180);
  const ky = 110_540;
  const plane = line.map(([lon, lat]) => [lon * kx, lat * ky]);

  /** Distance from a position to the segment between two others. */
  const distanceToSegment = (p: number[], a: number[], b: number[]): number => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };

  const last = line.length - 1;
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[last] = 1;
  const pending: [number, number][] = [[0, last]];
  while (pending.length > 0) {
    const [from, to] = pending.pop()!;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = from + 1; i < to; i++) {
      const d = distanceToSegment(plane[i], plane[from], plane[to]);
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = 1;
      pending.push([from, farthest], [farthest, to]);
    }
  }
  return line.filter((_, i) => keep[i] === 1);
}

/**
 * Join the segments of a hike into one elevation profile.
 *
 * Parameters
 * ----------
 * segments : list of Segment
 *     Consecutive segments, in order.
 *
 * Returns
 * -------
 * Profile or null
 *     ``null`` if there is no segment or if the elevation of one of them is
 *     missing.
 */
export function buildProfile(segments: Segment[]): Profile | null {
  if (segments.length === 0 || segments.some((s) => s.elevation === null)) return null;

  const distance: number[] = [];
  const elevation: number[] = [];
  const pointDistances = [0];
  let offset = 0;
  segments.forEach((segment, i) => {
    // The first sample of a segment is the last sample of the previous one.
    for (let k = i === 0 ? 0 : 1; k < segment.distance.length; k++) {
      distance.push(offset + segment.distance[k]);
      elevation.push(segment.elevation![k]);
    }
    offset += segment.length;
    pointDistances.push(offset);
  });
  return { distance, elevation, pointDistances };
}

/**
 * Compute total ascent and descent of an elevation profile.
 *
 * Elevation data is slightly noisy, and adding up every small wiggle would
 * inflate the result. So the profile is lightly smoothed (average of 3
 * neighbours), then a change only counts once it exceeds ``threshold``
 * meters since the last counted change.
 *
 * Parameters
 * ----------
 * elevations : list of float
 *     Elevation samples in meters.
 * threshold : float, default 3
 *     Smallest change counted, in meters.
 *
 * Returns
 * -------
 * object
 *     ``ascent`` and ``descent``, both positive, in meters.
 */
export function elevationChange(
  elevations: number[],
  threshold = 3,
): { ascent: number; descent: number } {
  const smooth = elevations.map((_, i) => {
    const window = elevations.slice(Math.max(0, i - 1), i + 2);
    return window.reduce((sum, e) => sum + e, 0) / window.length;
  });

  let ascent = 0;
  let descent = 0;
  let reference = smooth[0] ?? 0;
  for (const e of smooth) {
    const change = e - reference;
    if (Math.abs(change) >= threshold) {
      if (change > 0) ascent += change;
      else descent -= change;
      reference = e;
    }
  }
  return { ascent, descent };
}
