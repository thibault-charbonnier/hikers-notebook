/**
 * Walking route between two positions, from the IGN Géoplateforme.
 *
 * The service follows the paths and roads of the BD TOPO database (the same
 * data as the Plan IGN map). Free, no API key.
 */

import type { LngLat } from "./geo";

const ROUTE_URL = "https://data.geopf.fr/navigation/itineraire";
const TIMEOUT_MS = 20_000;

/**
 * Ask for a walking route between two positions.
 *
 * Parameters
 * ----------
 * start, end : LngLat
 *     The two positions. The service moves each one to the nearest path.
 *
 * Returns
 * -------
 * list of LngLat
 *     The route geometry, from start to end.
 *
 * Raises
 * ------
 * Error
 *     If the service fails or finds no route (for instance outside France).
 */
export async function fetchWalkingRoute(start: LngLat, end: LngLat): Promise<LngLat[]> {
  const params = new URLSearchParams({
    resource: "bdtopo-osrm",
    profile: "pedestrian",
    optimization: "shortest",
    start: start.join(","),
    end: end.join(","),
    geometryFormat: "geojson",
    getSteps: "false",
    crs: "EPSG:4326",
  });
  const response = await fetch(`${ROUTE_URL}?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Routing failed (HTTP ${response.status})`);

  const data = await response.json();
  const coordinates: LngLat[] | undefined = data.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) throw new Error("No route found");
  return coordinates.map(([lon, lat]) => [lon, lat]);
}
