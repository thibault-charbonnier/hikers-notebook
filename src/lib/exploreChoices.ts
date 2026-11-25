/**
 * What the "Explorer" window of the home map lets the person choose: which
 * layers are shown (my parcours, GR trails, regional parks, massifs, summits
 * and passes) and how the summits are filtered.
 *
 * The data behind these layers are static files in ``public/data`` (see the
 * README there and the scripts in ``tools/``).
 */

export interface ExploreChoices {
  /** My own parcours. */
  parcours: boolean;
  /** GR trails (long-distance hiking trails). */
  gr: boolean;
  /** Regional natural parks (hatched). */
  parks: boolean;
  /** Massifs (Chartreuse, Vercors, Aubrac...). */
  massifs: boolean;
  /** Summits, passes and other landmarks. */
  peaks: boolean;
  /** Summits (summits, peaks, mountains, volcanoes). */
  summits: boolean;
  /** Passes (cols). */
  passes: boolean;
  /** Crests, cirques, gorges, escarpments. */
  others: boolean;
  /** Lowest altitude shown, in meters (0 = no limit); 500 by default, so the hills of the plains do not crowd the map. */
  minEle: number;
}

export const DEFAULT_CHOICES: ExploreChoices = {
  parcours: true,
  gr: true,
  parks: true,
  massifs: true,
  peaks: true,
  summits: true,
  passes: true,
  others: false,
  minEle: 500,
};

/** Highest value of the "minimum altitude" slider. */
export const MAX_MIN_ELE = 4000;

const STORAGE_KEY = "hikers-notebook-explore";

/** The choices of the last visit merged over the defaults; never fails, whatever the browser allows. */
export function readChoices(): ExploreChoices {
  const choices = { ...DEFAULT_CHOICES };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object") {
      for (const key of Object.keys(DEFAULT_CHOICES) as (keyof ExploreChoices)[]) {
        if (typeof stored[key] === typeof DEFAULT_CHOICES[key]) (choices as Record<string, unknown>)[key] = stored[key];
      }
      choices.minEle = Math.min(MAX_MIN_ELE, Math.max(0, choices.minEle));
    }
  } catch {
    // nothing saved, or storage not allowed: the defaults do
  }
  return choices;
}

/** Remember the choices for the next visit (silently does nothing if the browser refuses). */
export function saveChoices(choices: ExploreChoices): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // not allowed: the choices last until the page is closed
  }
}
