/**
 * Tell whether a position is inside metropolitan France.
 *
 * The IGN data used for routing and elevation only covers France, so points
 * placed elsewhere are refused. The outline comes from the same file as the
 * dimming mask of the maps (``public/data/france-mask.geojson``): its first
 * ring is the world, the following rings are the pieces of France.
 */

import type { LngLat } from "./geo";
import { franceMaskUrl } from "./mapStyles";

interface Ring {
  coordinates: LngLat[];
  west: number;
  south: number;
  east: number;
  north: number;
}

let rings: Ring[] | null = null;

/** Build a ring with its bounding box, used to skip far-away rings quickly. */
function toRing(coordinates: LngLat[]): Ring {
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return {
    coordinates,
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats),
  };
}

/** Ray casting: count how many ring edges lie to the right of the position. */
function isInsideRing(lon: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i];
    const [lonJ, latJ] = ring[j];
    if (latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Download the France outline. Call once, early; safe to call again.
 *
 * Until it is loaded (or if the download fails), every position is accepted.
 */
export async function loadFrance(): Promise<void> {
  if (rings) return;
  try {
    const data = await (await fetch(franceMaskUrl())).json();
    const polygon: LngLat[][] = data.features[0].geometry.coordinates;
    rings = polygon.slice(1).map(toRing);
  } catch {
    // Keep ``rings`` empty: the check is then skipped.
  }
}

/**
 * Check whether a position is in metropolitan France.
 *
 * Parameters
 * ----------
 * lon, lat : float
 *     The position, in degrees.
 *
 * Returns
 * -------
 * bool
 *     True if inside France, or if the outline is not loaded yet.
 */
export function isInFrance(lon: number, lat: number): boolean {
  if (!rings) return true;
  return rings.some(
    (ring) =>
      lon >= ring.west &&
      lon <= ring.east &&
      lat >= ring.south &&
      lat <= ring.north &&
      isInsideRing(lon, lat, ring.coordinates),
  );
}
