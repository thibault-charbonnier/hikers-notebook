/**
 * Drawings of the three types of parcours (24 x 24, drawn with strokes).
 *
 * They are fixed strings, shared by the Svelte icon component and by the
 * information card of the overview map, which is built without Svelte.
 */

import type { ParcoursType } from "./parcours";

export const TYPE_ICON_MARKUP: Record<ParcoursType, string> = {
  // Footprints.
  marche:
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />' +
    '<path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />' +
    '<path d="M16 17h4" /><path d="M4 13h4" />',
  // Mountain.
  randonnee: '<path d="m8 3 4 8 5-5 5 15H2L8 3z" />',
  // Hiking dome tent: a dome with its door and the ground line.
  trek: '<path d="M3 19c0-6.5 4-12 9-12s9 5.5 9 12" /><path d="M9 19c0-3 1.3-5 3-5s3 2 3 5" /><path d="M1.5 19h21" />',
};
