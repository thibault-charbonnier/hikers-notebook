/**
 * Ground elevation from the IGN Géoplateforme altimetry service.
 *
 * Free, no API key. The service accepts about 300 positions per request (the
 * positions travel in the address), so long lists are split into chunks.
 */

import type { LngLat } from "./geo";

const ELEVATION_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
const CHUNK_SIZE = 150;
const PARALLEL_REQUESTS = 4;
const TIMEOUT_MS = 20_000;
const NO_DATA_BELOW = -1000; // the service answers -99999 where it has no data

/**
 * Fetch the elevation of one chunk of positions.
 *
 * Parameters
 * ----------
 * positions : list of LngLat
 *     At most ``CHUNK_SIZE`` positions.
 *
 * Returns
 * -------
 * list of float
 *     One elevation in meters per position (may contain no-data values).
 */
async function fetchChunk(positions: LngLat[]): Promise<number[]> {
  const params = new URLSearchParams({
    lon: positions.map(([lon]) => lon.toFixed(5)).join("|"),
    lat: positions.map(([, lat]) => lat.toFixed(5)).join("|"),
    resource: "ign_rge_alti_wld",
    zonly: "true",
  });
  const response = await fetch(`${ELEVATION_URL}?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Elevation failed (HTTP ${response.status})`);

  const data = await response.json();
  if (!Array.isArray(data.elevations) || data.elevations.length !== positions.length) {
    throw new Error("Unexpected elevation answer");
  }
  return data.elevations;
}

/**
 * Fetch the elevation of many positions.
 *
 * Positions without data take the value of the nearest valid neighbour
 * before them (or after them, at the very start).
 *
 * Parameters
 * ----------
 * positions : list of LngLat
 *     The positions, in any number.
 *
 * Returns
 * -------
 * list of float
 *     One elevation in meters per position.
 *
 * Raises
 * ------
 * Error
 *     If a request fails or if no position has data.
 */
export async function fetchElevations(positions: LngLat[]): Promise<number[]> {
  const chunks: LngLat[][] = [];
  for (let i = 0; i < positions.length; i += CHUNK_SIZE) {
    chunks.push(positions.slice(i, i + CHUNK_SIZE));
  }

  const results: number[][] = [];
  for (let i = 0; i < chunks.length; i += PARALLEL_REQUESTS) {
    const batch = chunks.slice(i, i + PARALLEL_REQUESTS);
    results.push(...(await Promise.all(batch.map(fetchChunk))));
  }

  const values = results.flat();
  const firstValid = values.find((v) => v > NO_DATA_BELOW);
  if (firstValid === undefined) throw new Error("No elevation data here");

  let previous = firstValid;
  return values.map((v) => (v > NO_DATA_BELOW ? (previous = v) : previous));
}
