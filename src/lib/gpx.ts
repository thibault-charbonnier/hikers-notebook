/**
 * Export a parcours as a GPX file.
 *
 * GPX is the standard text format for tracks, understood by nearly every
 * hiking app, GPS watch and website (Garmin, Strava, Komoot, Organic Maps...).
 * It only holds geography, not the rest of the notebook (rating, labels,
 * completion date...):
 *
 * - the **track** (``<trk>``): the route as a long list of points, each with
 *   its latitude, longitude and elevation. With several stages, there is one
 *   track per stage, so apps can show them as separate days;
 * - the **waypoints** (``<wpt>``): the numbered points of passage and the
 *   points of interest, with their name and note.
 */

import type { ParcoursFile } from "./parcours";
import { decodeSegment } from "./parcours";
import { distanceBetween } from "./geo";
import type { LngLat } from "./geo";
import { pinInfo } from "./poi";

/** Escape the characters that have a meaning in XML. */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Give an elevation to each position of a stretch of route.
 *
 * The elevation samples are evenly spaced along the stretch and are not
 * necessarily at the positions of the line, so each position takes the
 * elevation found at the same fraction of the way, by linear interpolation.
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The positions of the stretch, in order.
 * samples : list of float or None
 *     Evenly spaced elevations in meters, or ``null`` if unknown.
 *
 * Returns
 * -------
 * list of float or None
 *     One elevation per position, or ``null`` if there are no samples.
 */
function elevationsAlong(line: LngLat[], samples: number[] | null): number[] | null {
  if (!samples || samples.length === 0) return null;
  const cumulative = [0];
  for (let i = 1; i < line.length; i++) cumulative.push(cumulative[i - 1] + distanceBetween(line[i - 1], line[i]));
  const total = cumulative[cumulative.length - 1];
  return line.map((_, i) => {
    const position = total === 0 ? 0 : (cumulative[i] / total) * (samples.length - 1);
    const low = Math.floor(position);
    const high = Math.min(low + 1, samples.length - 1);
    return samples[low] + (samples[high] - samples[low]) * (position - low);
  });
}

/** One ``<trkpt>`` line. */
function trackPoint([lon, lat]: LngLat, elevation: number | null): string {
  const ele = elevation === null ? "" : `<ele>${elevation.toFixed(1)}</ele>`;
  return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${ele}</trkpt>`;
}

/** One ``<wpt>`` block. */
function waypoint(lon: number, lat: number, name: string, description: string | undefined, type: string): string {
  const desc = description ? `<desc>${xml(description)}</desc>` : "";
  return `  <wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${xml(name)}</name>${desc}<type>${xml(type)}</type></wpt>`;
}

/**
 * Build the GPX text of a parcours.
 *
 * Parameters
 * ----------
 * file : ParcoursFile
 *     The whole parcours, with its stretches of route.
 *
 * Returns
 * -------
 * str
 *     The content of the ``.gpx`` file.
 */
export function buildGpx(file: ParcoursFile): string {
  const points = file.waypoints;

  // A stage ends at each marked point (never the first or the last one). The
  // stretch number i goes from point i to point i + 1, so it belongs to the
  // stage given by the number of stage points at or before i.
  const stageEnds = points.flatMap((p, i) => (p.stage && i > 0 && i < points.length - 1 ? [i] : []));
  const stageCount = stageEnds.length + 1;
  const stageOf = (segmentIndex: number) => stageEnds.filter((k) => k <= segmentIndex).length;

  const stages: string[][] = Array.from({ length: stageCount }, () => []);
  file.segments.forEach((stored, index) => {
    const segment = decodeSegment(stored);
    const elevations = elevationsAlong(segment.coordinates, segment.elevation);
    const lines = stages[stageOf(index)];
    // The first position of a stretch is the last of the previous one: skip it.
    segment.coordinates.forEach((position, k) => {
      if (k === 0 && lines.length > 0) return;
      lines.push(trackPoint(position, elevations ? elevations[k] : null));
    });
  });

  const tracks = stages
    .filter((lines) => lines.length > 0)
    .map((lines, i) => {
      const name = stageCount > 1 ? `${file.name} - Étape ${i + 1}` : file.name;
      return `  <trk>\n    <name>${xml(name)}</name>\n    <trkseg>\n${lines.join("\n")}\n    </trkseg>\n  </trk>`;
    });

  const marks = points.map((p, i) =>
    waypoint(
      p.lon,
      p.lat,
      p.name || `Point ${i + 1}`,
      p.description,
      p.stage ? "Fin d'étape" : i === 0 ? "Départ" : i === points.length - 1 && !file.closed ? "Arrivée" : "Point de passage",
    ),
  );
  const pins = (file.pois ?? []).map((poi) =>
    waypoint(poi.lon, poi.lat, poi.name || pinInfo(poi.type).label, poi.description, pinInfo(poi.type).label),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Hiker's Notebook" xmlns="http://www.topografix.com/GPX/1/1">`,
    `  <metadata>`,
    `    <name>${xml(file.name)}</name>`,
    file.description ? `    <desc>${xml(file.description)}</desc>` : "",
    `    <time>${xml(file.updatedAt)}</time>`,
    `  </metadata>`,
    ...marks,
    ...pins,
    ...tracks,
    `</gpx>`,
    ``,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** A name that is safe to use for a file: no accents, no spaces, no symbols. */
export function fileNameFor(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "parcours"}.gpx`;
}

/**
 * Make the browser download the parcours as a GPX file, as for any download.
 *
 * Parameters
 * ----------
 * file : ParcoursFile
 *     The whole parcours.
 */
export function downloadGpx(file: ParcoursFile): void {
  const blob = new Blob([buildGpx(file)], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameFor(file.name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser start the download before the address is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
