/**
 * The overlays of the planning map (slope map, hiking routes) as map layers.
 *
 * Each overlay is a raster layer put over the base map and under the route.
 * They are all added when a style has loaded (a new base map wipes them), but
 * hidden; switching one on or off, or changing its transparency, only changes
 * a property of the layer, so it is instant. MapLibre fetches no tile for a
 * hidden layer.
 */

import type { Map as MapLibreMap } from "maplibre-gl";
import { OVERLAYS, type OverlayChoice, type OverlayId } from "./mapLayers";

const layerId = (id: OverlayId): string => `overlay-${id}`;

/** Add every overlay to the map, hidden. Call it once the style has loaded, before the layers that must stay on top. */
export function addOverlayLayers(map: MapLibreMap): void {
  for (const overlay of OVERLAYS) {
    const id = layerId(overlay.id);
    if (map.getSource(id)) continue;
    map.addSource(id, {
      type: "raster",
      tiles: [overlay.tiles],
      tileSize: 256,
      minzoom: 0,
      maxzoom: overlay.maxzoom,
      attribution: overlay.attribution,
    });
    map.addLayer({ id, type: "raster", source: id, layout: { visibility: "none" }, paint: { "raster-opacity": overlay.defaultOpacity } });
  }
}

/**
 * Show, hide and fade the overlays to match what is chosen.
 *
 * Parameters
 * ----------
 * map : Map
 *     The planning map, with its overlays added.
 * choices : dict
 *     ``on`` and ``opacity`` for each overlay.
 * allowed : bool
 *     False to hide them all whatever is chosen (they need a network).
 */
export function syncOverlays(map: MapLibreMap, choices: Record<OverlayId, OverlayChoice>, allowed: boolean): void {
  for (const overlay of OVERLAYS) {
    const id = layerId(overlay.id);
    if (!map.getLayer(id)) continue;
    const choice = choices[overlay.id];
    map.setLayoutProperty(id, "visibility", allowed && choice.on ? "visible" : "none");
    map.setPaintProperty(id, "raster-opacity", choice.opacity);
  }
}
