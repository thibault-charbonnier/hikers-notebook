/**
 * Points of interest and comments.
 *
 * A "point de passage" is a numbered point that shapes the route. A "point
 * d'intérêt" is different: it is placed anywhere on the map, is not numbered
 * and does not change the route. It marks something useful: a spring, a
 * bivouac spot, a shop... A "commentaire" is a note pinned on the map, shown
 * as a small message icon; clicking it opens the text in a large window.
 */

export type PoiType =
  | "water"
  | "bivouac"
  | "supply"
  | "rest"
  | "hut"
  | "viewpoint"
  | "danger"
  | "parking"
  | "other";

/** What can be placed on the map: a point of interest of some type, or a comment. */
export type PinType = PoiType | "comment";

export interface PinTypeInfo {
  id: PinType;
  label: string;
  /** Colour of its marker and icon. */
  color: string;
  /** Inside of the SVG icon (24 x 24, drawn with strokes). */
  icon: string;
}

/** The types of points of interest, in the order of the menu. */
export const POI_TYPES: PinTypeInfo[] = [
  {
    id: "water",
    label: "Source",
    color: "#1E88E5",
    icon: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  },
  {
    id: "bivouac",
    label: "Bivouac",
    color: "#43A047",
    icon: '<path d="M3 19c0-6.5 4-12 9-12s9 5.5 9 12"/><path d="M9 19c0-3 1.3-5 3-5s3 2 3 5"/><path d="M1.5 19h21"/>',
  },
  {
    id: "supply",
    label: "Ravitaillement",
    color: "#F57C00",
    icon: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  },
  {
    id: "rest",
    label: "Pause",
    color: "#8E24AA",
    icon: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  },
  {
    id: "hut",
    label: "Refuge",
    color: "#6D4C41",
    icon: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  },
  {
    id: "viewpoint",
    label: "Point de vue",
    color: "#00897B",
    icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  },
  {
    id: "danger",
    label: "Danger",
    color: "#E53935",
    icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  },
  {
    id: "parking",
    label: "Parking",
    color: "#546E7A",
    icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  },
  {
    id: "other",
    label: "Autre",
    color: "#3949AB",
    icon: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  },
];

/** The comment, a special pin shown as a message bubble. */
export const COMMENT: PinTypeInfo = {
  id: "comment",
  label: "Commentaire",
  color: "#E0A100",
  icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

/**
 * Find the description of a type of pin.
 *
 * Parameters
 * ----------
 * type : PinType
 *     A point-of-interest type, or ``"comment"``.
 *
 * Returns
 * -------
 * PinTypeInfo
 *     Its label, colour and icon.
 */
export function pinInfo(type: PinType): PinTypeInfo {
  return type === "comment" ? COMMENT : (POI_TYPES.find((t) => t.id === type) ?? POI_TYPES[POI_TYPES.length - 1]);
}

/** A point of interest or a comment placed on the map. */
export interface Poi {
  id: string;
  lon: number;
  lat: number;
  type: PinType;
  name: string;
  /** For a comment, the text of the comment. */
  description: string;
}

/** How a pin is stored in a file (empty fields are left out). */
export interface StoredPoi {
  lon: number;
  lat: number;
  type: PinType;
  name?: string;
  description?: string;
}
