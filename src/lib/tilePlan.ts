/**
 * Which map tiles cover a parcours: the arithmetic behind the offline download.
 *
 * A map is a grid of square tiles. At zoom 0 one tile covers the world; each
 * zoom level cuts every tile into four. A tile is named by its zoom ``z`` and
 * its column ``x`` and row ``y`` in the grid of that zoom (the "XYZ" scheme
 * that MapLibre and most map servers use).
 *
 * To work without network, the app saves the tiles of a *corridor*: every
 * tile that lies within some distance of the route. Along a route the
 * corridor holds far fewer tiles than the rectangle around it.
 */

import type { LngLat } from "./geo";
import { distanceBetween } from "./geo";

export interface Tile {
  z: number;
  x: number;
  y: number;
}

/** Length of the equator in meters, to turn a distance into a number of tiles. */
const EQUATOR_M = 40_075_016.686;

/** Column of the tile that holds a longitude, as a fraction (the integer part is the column). */
function tileColumn(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}

/** Row of the tile that holds a latitude, as a fraction (the integer part is the row). */
function tileRow(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

/** Width of a tile in meters, at a latitude. */
function tileWidthMeters(lat: number, z: number): number {
  return (EQUATOR_M * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/**
 * Put a point every ``stepMeters`` or so along a line.
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The route.
 * stepMeters : float
 *     The largest gap allowed between two consecutive points.
 *
 * Returns
 * -------
 * list of LngLat
 *     The same route, with extra points on long stretches.
 */
function densify(line: LngLat[], stepMeters: number): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const parts = Math.max(1, Math.ceil(distanceBetween(a, b) / stepMeters));
    for (let k = 0; k < parts; k++) {
      out.push([a[0] + ((b[0] - a[0]) * k) / parts, a[1] + ((b[1] - a[1]) * k) / parts]);
    }
  }
  if (line.length > 0) out.push(line[line.length - 1]);
  return out;
}

/**
 * The tiles within ``bufferMeters`` of a route, at one zoom level.
 *
 * Parameters
 * ----------
 * line : list of LngLat
 *     The route.
 * z : int
 *     The zoom level.
 * bufferMeters : float
 *     How far from the route a tile may be and still count.
 *
 * Returns
 * -------
 * list of Tile
 *     The corridor at this zoom, without duplicates.
 */
export function corridorTiles(line: LngLat[], z: number, bufferMeters: number): Tile[] {
  const seen = new Map<string, Tile>();
  const limit = 2 ** z - 1;
  for (const [lon, lat] of densify(line, 50)) {
    const reach = bufferMeters / tileWidthMeters(lat, z); // buffer, in tiles
    const column = tileColumn(lon, z);
    const row = tileRow(lat, z);
    for (let x = Math.floor(column - reach); x <= Math.floor(column + reach); x++) {
      for (let y = Math.floor(row - reach); y <= Math.floor(row + reach); y++) {
        if (x < 0 || y < 0 || x > limit || y > limit) continue;
        seen.set(`${x}/${y}`, { z, x, y });
      }
    }
  }
  return [...seen.values()];
}

/**
 * All the tiles of a rectangle, at one zoom level.
 *
 * Parameters
 * ----------
 * bounds : list
 *     ``[[west, south], [east, north]]`` in degrees.
 * z : int
 *     The zoom level.
 *
 * Returns
 * -------
 * list of Tile
 *     Every tile that touches the rectangle.
 */
export function rectangleTiles(bounds: [[number, number], [number, number]], z: number): Tile[] {
  const [[west, south], [east, north]] = bounds;
  const limit = 2 ** z - 1;
  const x0 = Math.max(0, Math.floor(tileColumn(west, z)));
  const x1 = Math.min(limit, Math.floor(tileColumn(east, z)));
  const y0 = Math.max(0, Math.floor(tileRow(north, z)));
  const y1 = Math.min(limit, Math.floor(tileRow(south, z)));
  const tiles: Tile[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ z, x, y });
  return tiles;
}

/** Fill the ``{z}``, ``{x}`` and ``{y}`` of a tile address template. */
export function tileUrl(template: string, tile: Tile): string {
  return template.replace("{z}", String(tile.z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
}
