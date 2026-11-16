/**
 * Compact text encoding of numbers and lines.
 *
 * It is the "encoded polyline" algorithm popularised by Google Maps: values
 * are stored as differences from the previous one, and each difference takes
 * as few printable characters as it needs. A walking route of 800 points
 * takes about 4 kB this way, against about 25 kB as plain JSON coordinates.
 */

import type { LngLat } from "./geo";

/** Positions are stored with 5 decimals, about 1 meter. */
const POSITION_SCALE = 1e5;

/** Encode one integer as printable characters. */
function encodeInteger(value: number): string {
  let rest = value < 0 ? ~(value << 1) : value << 1;
  let text = "";
  while (rest >= 0x20) {
    text += String.fromCharCode((0x20 | (rest & 0x1f)) + 63);
    rest >>= 5;
  }
  return text + String.fromCharCode(rest + 63);
}

/** Read the integers stored in a text, one after the other. */
function* readIntegers(text: string): Generator<number> {
  let index = 0;
  while (index < text.length) {
    let result = 0;
    let shift = 0;
    let chunk: number;
    do {
      chunk = text.charCodeAt(index++) - 63;
      result |= (chunk & 0x1f) << shift;
      shift += 5;
    } while (chunk >= 0x20);
    yield result & 1 ? ~(result >> 1) : result >> 1;
  }
}

/**
 * Encode a list of integers, each stored as the difference from the previous.
 *
 * Parameters
 * ----------
 * values : list of int
 *     The integers. Slowly changing values (such as elevations) give the
 *     shortest text.
 *
 * Returns
 * -------
 * str
 *     The encoded text.
 */
export function encodeDeltas(values: number[]): string {
  let previous = 0;
  let text = "";
  for (const value of values) {
    text += encodeInteger(value - previous);
    previous = value;
  }
  return text;
}

/**
 * Decode a text made by ``encodeDeltas``.
 *
 * Parameters
 * ----------
 * text : str
 *     The encoded text.
 *
 * Returns
 * -------
 * list of int
 *     The original integers.
 */
export function decodeDeltas(text: string): number[] {
  let value = 0;
  return Array.from(readIntegers(text), (delta) => (value += delta));
}

/**
 * Encode a line (a list of positions), with a precision of about 1 meter.
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The positions, as ``[longitude, latitude]``.
 *
 * Returns
 * -------
 * str
 *     The encoded text.
 */
export function encodePolyline(line: LngLat[]): string {
  let previousLat = 0;
  let previousLon = 0;
  let text = "";
  for (const [lon, lat] of line) {
    const scaledLat = Math.round(lat * POSITION_SCALE);
    const scaledLon = Math.round(lon * POSITION_SCALE);
    text += encodeInteger(scaledLat - previousLat) + encodeInteger(scaledLon - previousLon);
    previousLat = scaledLat;
    previousLon = scaledLon;
  }
  return text;
}

/**
 * Decode a text made by ``encodePolyline``.
 *
 * Parameters
 * ----------
 * text : str
 *     The encoded text.
 *
 * Returns
 * -------
 * list of LngLat
 *     The positions, as ``[longitude, latitude]``.
 */
export function decodePolyline(text: string): LngLat[] {
  const line: LngLat[] = [];
  let lat = 0;
  let lon = 0;
  const numbers = readIntegers(text);
  for (let next = numbers.next(); !next.done; next = numbers.next()) {
    lat += next.value;
    lon += numbers.next().value ?? 0;
    line.push([lon / POSITION_SCALE, lat / POSITION_SCALE]);
  }
  return line;
}
