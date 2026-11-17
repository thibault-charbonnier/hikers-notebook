/** Small display choices shared by several components. */

import { todayIso } from "./dates";
import { BASE_MAPS, OVERLAYS, type BaseMapId, type OverlayChoice, type OverlayId, type ViewMode } from "./mapLayers";

const STORAGE_KEY = "hikers-notebook-layers";

interface SavedLayers {
  baseMap: BaseMapId;
  overlays: Record<OverlayId, OverlayChoice>;
}

/** The layer choices of the last visit (or the defaults); never fails, whatever the browser allows. */
function readSavedLayers(): SavedLayers {
  const overlays = Object.fromEntries(
    OVERLAYS.map((overlay) => [overlay.id, { on: false, opacity: overlay.defaultOpacity }]),
  ) as Record<OverlayId, OverlayChoice>;
  const saved: SavedLayers = { baseMap: "plan-ign", overlays };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && BASE_MAPS.some((map) => map.id === stored.baseMap)) saved.baseMap = stored.baseMap;
    for (const overlay of OVERLAYS) {
      const choice = stored?.overlays?.[overlay.id];
      if (choice && typeof choice.on === "boolean" && typeof choice.opacity === "number") {
        saved.overlays[overlay.id] = { on: choice.on, opacity: Math.min(1, Math.max(0.1, choice.opacity)) };
      }
    }
  } catch {
    // nothing saved, or storage not allowed: the defaults do
  }
  return saved;
}

class Ui {
  /** Base map and overlays chosen in the layers window (remembered from one visit to the next). */
  baseMap = $state<BaseMapId>(readSavedLayers().baseMap);
  overlays = $state<Record<OverlayId, OverlayChoice>>(readSavedLayers().overlays);
  /** 2D or 3D, chosen with the "3D" button of the action bar. */
  viewMode = $state<ViewMode>("2d");
  /**
   * Distance in pixels from the top of the planning map to the bottom of the
   * hike bar, so that the tool palette can sit right under it on a phone.
   */
  topBarBottom = $state(190);
  /**
   * True while the "Détails" part of the hike bar is open. On a phone the
   * floating buttons of the map hide meanwhile, so they do not pile up on it.
   */
  detailsOpen = $state(false);
  /** Choose the base map. */
  setBaseMap(id: BaseMapId): void {
    this.baseMap = id;
    this.#remember();
  }

  /** Switch an overlay on or off, or change its transparency. */
  setOverlay(id: OverlayId, change: Partial<OverlayChoice>): void {
    this.overlays = { ...this.overlays, [id]: { ...this.overlays[id], ...change } };
    this.#remember();
  }

  #remember(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseMap: this.baseMap, overlays: this.overlays }));
    } catch {
      // not allowed: the choice simply lasts until the page is closed
    }
  }

  /** What the elevation profile shows: the altitude alone, or the slopes in colour. */
  profileMode = $state<"altitude" | "slope">("altitude");
  /** Tab of the right-hand panel of the planning page. */
  panelTab = $state<"route" | "weather">("route");
  /** Day of the first stage, for the weather and the sun times (``YYYY-MM-DD``). */
  weatherDate = $state(todayIso());
}

export const ui = new Ui();
