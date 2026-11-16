/**
 * User actions that involve several parts of the app: saving the parcours,
 * opening a saved one, starting a new one.
 */

import { hike } from "./hike.svelte.js";
import { library } from "./library.svelte.js";
import * as storage from "./storage";

const UNSAVED_QUESTION = "Les modifications non enregistrées seront perdues. Continuer ?";
const STORAGE_UNAVAILABLE = "Enregistrement impossible : lance l'appli avec « npm run dev ».";

/**
 * Ask before throwing away unsaved changes.
 *
 * Returns
 * -------
 * bool
 *     True if there is nothing to lose or if the user agrees.
 */
export function confirmDiscard(): boolean {
  return !hike.dirty || confirm(UNSAVED_QUESTION);
}

/** Save the current parcours and tell the user how it went. */
export async function saveHike(): Promise<void> {
  if (!hike.name.trim()) hike.name = "Sans nom";
  if (!hike.color) hike.color = library.nextColor();

  const file = hike.toFile();
  if (!file) {
    hike.notify("Place au moins deux points de passage et attends la fin du calcul pour enregistrer.");
    return;
  }
  try {
    await storage.saveParcours(file);
  } catch {
    hike.notify(STORAGE_UNAVAILABLE);
    return;
  }
  hike.markSaved(file);
  await library.refresh();
  hike.notify("Parcours enregistré.", "success");
}

/** Read a saved parcours into the planner. */
export async function openParcours(id: string): Promise<void> {
  try {
    hike.load(await storage.loadParcours(id));
  } catch {
    hike.notify("Impossible d'ouvrir ce parcours.");
  }
}

/** Show a saved parcours in the planner (asks first if there are unsaved changes). */
export function goToParcours(id: string): void {
  if (hike.id !== id && !confirmDiscard()) return;
  location.hash = `#/planifier/${id}`;
}

/**
 * Prepare the planner when the user clicks "Planifier un parcours".
 *
 * A parcours that is already saved and unchanged is put away to start a fresh
 * one. Work in progress is kept, so nothing is lost by a click.
 */
export function prepareNewPlanning(): void {
  if (hike.isSaved && !hike.dirty) hike.reset();
}
