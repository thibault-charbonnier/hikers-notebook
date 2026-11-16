/** Small display choices shared by several components. */

import { todayIso } from "./dates";

class Ui {
  /** What the elevation profile shows: the altitude alone, or the slopes in colour. */
  profileMode = $state<"altitude" | "slope">("altitude");
  /** Tab of the right-hand panel of the planning page. */
  panelTab = $state<"route" | "weather">("route");
  /** Day of the first stage, for the weather and the sun times (``YYYY-MM-DD``). */
  weatherDate = $state(todayIso());
}

export const ui = new Ui();
