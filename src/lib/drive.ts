/**
 * Time by car from the person's home, from the free routing service of the IGN
 * (the same one used to draw the walking routes, here with the "car" profile).
 *
 * The times are approximate: no traffic, and the speeds of the road network.
 * The service snaps a place that is not on a road (a summit, the middle of a
 * massif) to the nearest road, so for those the time is "to the nearest road".
 *
 * The home is chosen in the profile (see ProfileDialog.svelte); only its
 * coordinates are kept, in the person's own account. They are sent to the IGN
 * each time a time is worked out.
 */

import type { LngLat } from "./geo";

/** The home address, as chosen in the profile. */
export interface HomeAddress {
  label: string;
  lon: number;
  lat: number;
}

/** A time by car, kept with a parcours. ``from`` and ``to`` tell what it was worked out for. */
export interface Drive {
  minutes: number;
  km: number;
  from: string;
  to: string;
}

const ROUTE_URL = "https://data.geopf.fr/navigation/itineraire";
const TIMEOUT_MS = 20_000;

/** A place as a short text (about 10 m), to tell whether a time still fits a place. */
export const placeKey = ([lon, lat]: LngLat): string => `${lon.toFixed(4)},${lat.toFixed(4)}`;

/** The answers already obtained (the same place is often asked twice). */
const known = new Map<string, Promise<{ minutes: number; km: number } | null>>();

/**
 * Time and distance by car between two places.
 *
 * Parameters
 * ----------
 * from : LngLat
 *     Where the trip starts (the home).
 * to : LngLat
 *     Where it ends.
 *
 * Returns
 * -------
 * dict or null
 *     ``minutes`` and ``km``, or ``null`` if the service has no answer (no
 *     road, no network...).
 */
export function driveBetween(from: LngLat, to: LngLat): Promise<{ minutes: number; km: number } | null> {
  const key = `${placeKey(from)}>${placeKey(to)}`;
  let answer = known.get(key);
  if (!answer) {
    answer = fetchRoute(from, to);
    known.set(key, answer);
    // A failure is not remembered: it may work next time.
    answer.then((result) => result === null && known.delete(key));
  }
  return answer;
}

async function fetchRoute(from: LngLat, to: LngLat): Promise<{ minutes: number; km: number } | null> {
  const params = new URLSearchParams({
    resource: "bdtopo-osrm",
    profile: "car",
    optimization: "fastest",
    start: `${from[0].toFixed(5)},${from[1].toFixed(5)}`,
    end: `${to[0].toFixed(5)},${to[1].toFixed(5)}`,
    getSteps: "false",
    geometryFormat: "polyline",
    distanceUnit: "kilometer",
    timeUnit: "minute",
  });
  try {
    const response = await fetch(`${ROUTE_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.duration !== "number" || typeof data.distance !== "number") return null;
    return { minutes: Math.round(data.duration), km: Math.round(data.distance * 10) / 10 };
  } catch {
    return null;
  }
}

/** Work out the ``Drive`` of a parcours (home to its start), or ``null``. */
export async function driveToStart(home: HomeAddress, start: LngLat): Promise<Drive | null> {
  const from: LngLat = [home.lon, home.lat];
  const result = await driveBetween(from, start);
  return result && { ...result, from: placeKey(from), to: placeKey(start) };
}

/** Tell whether a ``Drive`` was worked out for this home and this start. */
export function driveFits(drive: Drive | null | undefined, home: HomeAddress, start: LngLat): boolean {
  return !!drive && drive.from === placeKey([home.lon, home.lat]) && drive.to === placeKey(start);
}

/**
 * Write a duration the way people say it.
 *
 * Examples
 * --------
 * >>> formatDuration(35)
 * '35 min'
 * >>> formatDuration(65)
 * '1 h 05'
 * >>> formatDuration(120)
 * '2 h'
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
