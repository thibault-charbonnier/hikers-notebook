/**
 * What the "calques" (layers) button of the planning map offers.
 *
 * Two kinds of layers, chosen in the same window:
 *
 * - the **base map**: what is drawn on the ground. One at a time: the Plan IGN
 *   (a vector map, with paths and contour lines) or the aerial photos. Each
 *   comes with a small picture shown in the window;
 * - the **overlays**: pictures laid over the base map, each with its own
 *   on/off switch and transparency: the slope map and the waymarked hiking
 *   routes (GR, PR...).
 *
 * The view (2D or 3D, ``ui.viewMode``) is a separate choice, made with the "3D"
 * button of the action bar: 3D is a way of looking at any of these, not a map
 * of its own (see terrain.ts).
 *
 * Only the Plan IGN can be saved for offline use for now (see
 * offlineDownload.ts); the others need a network, and say so in the window.
 */

import aerialThumbnail from "../assets/layers/aerial.jpg";
import planIgnThumbnail from "../assets/layers/plan-ign.jpg";

export type BaseMapId = "plan-ign" | "aerial";
export type OverlayId = "slopes" | "trails";
export type ViewMode = "2d" | "3d";

export interface BaseMapInfo {
  id: BaseMapId;
  label: string;
  description: string;
  /** Small picture of what the map looks like (3:2), over a hilly area. */
  thumbnail: string;
  /** True if it can be saved for offline use. */
  offline: boolean;
}

/** The base maps, in the order of the window. */
export const BASE_MAPS: BaseMapInfo[] = [
  {
    id: "plan-ign",
    label: "Plan IGN",
    description: "Carte topographique : sentiers, courbes de niveau, refuges.",
    thumbnail: planIgnThumbnail,
    offline: true,
  },
  {
    id: "aerial",
    label: "Photos aériennes",
    description: "Photographies aériennes de l'IGN (20 cm).",
    thumbnail: aerialThumbnail,
    offline: false,
  },
];

export interface OverlayInfo {
  id: OverlayId;
  label: string;
  description: string;
  /** Address of the tiles; ``{z}``, ``{x}`` and ``{y}`` are the zoom, column and row of a tile. */
  tiles: string;
  /** Deepest zoom the service has (deeper views enlarge these tiles). */
  maxzoom: number;
  /** Credit shown on the map while the overlay is on. */
  attribution: string;
  /** Transparency the first time it is switched on: 1 is opaque. */
  defaultOpacity: number;
}

/** Address of a layer of the IGN Géoplateforme, in the web-mercator tiling used by the maps. */
const ign = (layer: string, format: "image/png" | "image/jpeg"): string =>
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM" +
  `&LAYER=${layer}&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

/** Aerial photos of the IGN (also the base of the "aerial" map). */
export const AERIAL_TILES = ign("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg");

/** The overlays, in the order of the window (and drawn in that order, the last on top). */
export const OVERLAYS: OverlayInfo[] = [
  {
    id: "slopes",
    label: "Pentes",
    description: "Les pentes raides en couleur (utile en montagne, surtout l'hiver).",
    tiles: ign("GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN", "image/png"),
    maxzoom: 17,
    attribution: '<a href="https://geoservices.ign.fr">© IGN</a>',
    defaultOpacity: 0.6,
  },
  {
    id: "trails",
    label: "Sentiers GR",
    description: "Itinéraires de randonnée balisés (GR, GRP, PR...), d'après OpenStreetMap.",
    tiles: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
    maxzoom: 18,
    attribution:
      '<a href="https://hiking.waymarkedtrails.org">© Waymarked Trails</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    defaultOpacity: 0.9,
  },
];

/** What is chosen for an overlay. */
export interface OverlayChoice {
  on: boolean;
  /** 0 (invisible) to 1 (opaque). */
  opacity: number;
}
