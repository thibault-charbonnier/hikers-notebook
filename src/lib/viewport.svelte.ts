/**
 * Which kind of screen the app is shown on.
 *
 * The same code serves the computer and the phone: on a narrow screen the side
 * bars are replaced by a sheet that slides up from the bottom. The value
 * follows the window, so rotating the phone or resizing the window updates it.
 */

/** Screens at most this wide (in CSS pixels) are treated as phones. */
const PHONE_MAX_WIDTH = 720;

class Viewport {
  /** ``true`` on a narrow screen (phone). */
  phone = $state(false);

  constructor() {
    if (typeof window === "undefined") return;
    const query = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    this.phone = query.matches;
    query.addEventListener("change", (event) => (this.phone = event.matches));
  }
}

export const viewport = new Viewport();
