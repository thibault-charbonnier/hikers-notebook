/** The state of the "Explorer" window of the home map, shared by its components. */

import { DEFAULT_CHOICES, readChoices, saveChoices, type ExploreChoices } from "./exploreChoices";
import type { PlaceEntry } from "./searchIndex";

class Explore {
  /** What is shown on the map (remembered from one visit to the next). */
  choices = $state<ExploreChoices>(readChoices());
  /** True while the Explorer window is open. */
  open = $state(false);
  /** The place picked in the search box (drawn over the map, the rest faded), or ``null``. */
  highlight = $state.raw<PlaceEntry | null>(null);

  /** Change one or several choices. */
  set(change: Partial<ExploreChoices>): void {
    this.choices = { ...this.choices, ...change };
    saveChoices(this.choices);
  }

  /** Back to the default choices. */
  reset(): void {
    this.choices = { ...DEFAULT_CHOICES };
    saveChoices(this.choices);
  }
}

export const explore = new Explore();
