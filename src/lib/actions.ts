/**
 * User actions that involve several parts of the app: saving the parcours,
 * opening a saved one, starting a new one, deleting one, exporting it as GPX.
 * When one of them fails, the person is told with the standard message window
 * (see ``feedback.svelte.ts``).
 */

import { feedback } from "./feedback.svelte.js";
import { downloadGpx } from "./gpx";
import { hike } from "./hike.svelte.js";
import { library } from "./library.svelte.js";
import { connection } from "./online.svelte.js";
import { createShareLink, shareUrl } from "./sharing";
import * as storage from "./storage";

const UNSAVED_QUESTION = "Les modifications non enregistrées seront perdues. Continuer ?";

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

/** Without network the parcours can be read but not changed: say so. Returns true if that is the case. */
function readOnly(): boolean {
  if (connection.online) return false;
  feedback.info("Hors réseau", "Sans réseau, les parcours sont en lecture seule. Reconnecte-toi pour enregistrer ou supprimer.");
  return true;
}

/** Save the current parcours and tell the user how it went. */
export async function saveHike(): Promise<void> {
  if (readOnly()) return;
  if (!hike.name.trim()) hike.name = "Sans nom";
  if (!hike.color) hike.color = library.nextColor();

  const file = hike.toFile();
  if (!file) {
    hike.notify("Place au moins deux points de passage et attends la fin du calcul pour enregistrer.");
    return;
  }
  try {
    await storage.saveParcours(file);
  } catch (error) {
    feedback.problem("enregistrer le parcours", error);
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
  } catch (error) {
    feedback.problem("ouvrir ce parcours", error);
  }
}

/** Show a saved parcours in the planner (asks first if there are unsaved changes). */
export function goToParcours(id: string): void {
  if (hike.id !== id && !confirmDiscard()) return;
  location.hash = `#/hike/${id}`;
}

/**
 * Delete a saved parcours for good.
 *
 * Returns
 * -------
 * bool
 *     False if it could not be deleted (the person has been told).
 */
export async function removeParcours(id: string): Promise<boolean> {
  if (readOnly()) return false;
  try {
    await storage.deleteParcours(id);
  } catch (error) {
    feedback.problem("supprimer le parcours", error);
    return false;
  }
  if (hike.id === id) hike.reset();
  if (library.selectedId === id) library.selectedId = null;
  await library.refresh();
  return true;
}

/** Download the parcours on screen (with its unsaved changes) as a GPX file. */
export function exportCurrentGpx(): void {
  const file = hike.toFile();
  if (!file) {
    hike.notify("Place au moins deux points de passage et attends la fin du calcul pour exporter.");
    return;
  }
  try {
    downloadGpx(file);
  } catch (error) {
    feedback.problem("exporter le fichier GPX", error);
  }
}

/** Download a saved parcours as a GPX file, without opening it. */
export async function exportGpxOf(id: string): Promise<void> {
  try {
    downloadGpx(await storage.loadParcours(id));
  } catch (error) {
    feedback.problem("exporter le fichier GPX", error);
  }
}

/**
 * Share a saved parcours by a link.
 *
 * On a phone the phone's own share sheet opens (messages, mail, social apps...).
 * On a computer, or if the phone cannot do that, a window shows the link with a
 * button to copy it.
 *
 * Parameters
 * ----------
 * id : str
 *     The saved parcours.
 * name : str
 *     Its name, for the message that goes with the link.
 */
export async function shareParcours(id: string, name: string): Promise<void> {
  if (!connection.online) {
    feedback.info("Hors réseau", "Il faut du réseau pour partager un parcours.");
    return;
  }
  let url: string;
  try {
    url = shareUrl(await createShareLink(id));
  } catch (error) {
    feedback.problem("créer le lien de partage", error);
    return;
  }

  const touchDevice = matchMedia("(pointer: coarse)").matches;
  if (touchDevice && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: name, text: `Un parcours de randonnée : « ${name} »`, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // the sheet was closed
      // any other failure: fall back on the window below
    }
  }
  library.shareFor = { name, url };
}

/**
 * Open the offline window of a saved parcours (download, update or remove).
 *
 * The parcours must be saved in the database: the download saves the map
 * along the route that is stored there.
 */
export function openOfflineWindow(id: string): void {
  const summary = library.items.find((item) => item.id === id);
  if (!summary) {
    feedback.info("Enregistre d'abord", "Enregistre le parcours avant de le télécharger pour le mode hors réseau.");
    return;
  }
  library.offlineFor = summary;
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
