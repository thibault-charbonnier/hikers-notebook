/**
 * Slopes of the route: how steep each stretch is, and the colour that shows it.
 *
 * The elevation profile has one sample every 25 m or so, which is too noisy to
 * read a slope sample by sample. The route is therefore cut into stretches of
 * 100 m (200 m on hikes longer than 15 km) and the slope of each is the
 * elevation change over its length.
 */

import type { Profile } from "./geo";

/** A stretch of the route and its slope. */
export interface SlopeBin {
  /** Start and end, as distances from the start of the hike, in meters. */
  from: number;
  to: number;
  /** Slope in percent: positive uphill, negative downhill. */
  slope: number;
}

/** Colour of each slope (in percent): cool tones downhill, warm tones uphill. */
export const SLOPE_COLORS: [number, string][] = [
  [-30, "#2b2f8f"],
  [-20, "#3b5bc2"],
  [-10, "#44a8d9"],
  [-4, "#7ecbb0"],
  [0, "#9bcb6b"],
  [4, "#c9d45b"],
  [8, "#f1c945"],
  [12, "#f29d3d"],
  [18, "#e5533d"],
  [30, "#7a1f3d"],
];

/** Slopes shown in the legend, in percent. */
export const SLOPE_LEGEND = [-20, -10, 0, 10, 20];

/** Hikes shorter than this get stretches of 100 m, longer ones of 200 m. */
const LONG_HIKE_M = 15_000;

/**
 * Choose the length of the stretches for a hike.
 *
 * 100 m for hikes shorter than 15 km, 200 m above: on a long hike, stretches
 * of 100 m make the colours change too often to be read.
 *
 * Parameters
 * ----------
 * total : float
 *     Length of the hike in meters.
 *
 * Returns
 * -------
 * float
 *     Length of a stretch in meters (100 or 200).
 */
export function slopeBinLength(total: number): number {
  return total < LONG_HIKE_M ? 100 : 200;
}

/**
 * Elevation at a distance from the start, by linear interpolation of the samples.
 *
 * Parameters
 * ----------
 * profile : Profile
 *     The elevation profile of the hike.
 * distance : float
 *     Distance from the start, in meters.
 *
 * Returns
 * -------
 * float
 *     Elevation in meters.
 */
export function elevationAt(profile: Profile, distance: number): number {
  const { distance: d, elevation: e } = profile;
  let lo = 0;
  let hi = d.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d[mid] < distance) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return e[0];
  const span = d[lo] - d[lo - 1] || 1;
  const t = (distance - d[lo - 1]) / span;
  return e[lo - 1] + (e[lo] - e[lo - 1]) * Math.min(Math.max(t, 0), 1);
}

/**
 * Cut the route into stretches and compute the slope of each.
 *
 * Parameters
 * ----------
 * profile : Profile
 *     The elevation profile of the hike.
 * binLength : float, optional
 *     Length of a stretch in meters. By default, chosen from the hike length.
 *
 * Returns
 * -------
 * list of SlopeBin
 *     The stretches, in order, covering the whole hike.
 */
export function slopeBins(profile: Profile, binLength?: number): SlopeBin[] {
  const total = profile.distance[profile.distance.length - 1];
  if (!(total > 0)) return [];
  const length = binLength ?? slopeBinLength(total);
  const count = Math.max(1, Math.round(total / length));
  const bins: SlopeBin[] = [];
  for (let k = 0; k < count; k++) {
    const from = (total * k) / count;
    const to = (total * (k + 1)) / count;
    bins.push({ from, to, slope: ((elevationAt(profile, to) - elevationAt(profile, from)) / (to - from)) * 100 });
  }
  return bins;
}

/** Parse "#rrggbb" into its three channels. */
function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * Give the colour of a slope.
 *
 * Parameters
 * ----------
 * slope : float
 *     Slope in percent (positive uphill).
 *
 * Returns
 * -------
 * str
 *     A CSS colour, interpolated between the stops of ``SLOPE_COLORS``.
 */
export function slopeColor(slope: number): string {
  const first = SLOPE_COLORS[0];
  const last = SLOPE_COLORS[SLOPE_COLORS.length - 1];
  if (slope <= first[0]) return first[1];
  if (slope >= last[0]) return last[1];
  for (let i = 1; i < SLOPE_COLORS.length; i++) {
    const [upper, upperColor] = SLOPE_COLORS[i];
    if (slope <= upper) {
      const [lower, lowerColor] = SLOPE_COLORS[i - 1];
      const t = (slope - lower) / (upper - lower);
      const a = channels(lowerColor);
      const b = channels(upperColor);
      return `rgb(${a.map((v, c) => Math.round(v + (b[c] - v) * t)).join(",")})`;
    }
  }
  return last[1];
}
