/**
 * Address suggestions, from the free geocoding service of the IGN (the
 * "Géoplateforme"). As in the forms of many web sites, the person types and a
 * list of real addresses drops down: picking one guarantees that it exists and
 * gives its position.
 */

import type { HomeAddress } from "./drive";

const COMPLETION_URL = "https://data.geopf.fr/geocodage/completion/";
const TIMEOUT_MS = 10_000;

/**
 * Suggest addresses (and places such as villages) for what is typed.
 *
 * Parameters
 * ----------
 * text : str
 *     What the person typed so far (at least 3 characters).
 * signal : AbortSignal, optional
 *     To drop the request if the person keeps typing.
 *
 * Returns
 * -------
 * list of HomeAddress
 *     Up to 6 suggestions, the best first; empty if nothing matches or the
 *     service cannot be reached.
 */
export async function suggestAddresses(text: string, signal?: AbortSignal): Promise<HomeAddress[]> {
  const query = text.trim();
  if (query.length < 3) return [];
  const params = new URLSearchParams({
    text: query,
    type: "StreetAddress,PositionOfInterest",
    maximumResponses: "6",
    terr: "METROPOLE",
  });
  try {
    const response = await fetch(`${COMPLETION_URL}?${params}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results ?? [])
      .filter((r: { x?: number; y?: number; fulltext?: string }) => typeof r.x === "number" && typeof r.y === "number" && r.fulltext)
      .map((r: { x: number; y: number; fulltext: string }) => ({ label: r.fulltext, lon: r.x, lat: r.y }));
  } catch {
    return [];
  }
}
