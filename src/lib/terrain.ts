/**
 * 3D view of the planning map: relief and a tilted camera.
 *
 * 3D is not a map of its own: it is a way of looking at whatever base map is
 * shown. It adds a layer of altitudes under the base map (MapLibre bends the
 * map over it) and tilts the camera. MapLibre only fetches the tiles it needs
 * for what is on screen, so nothing has to be cut into blocks by hand.
 *
 * The altitudes come from the free "Terrain Tiles" of Amazon's open data
 * programme (here built from European elevation data, about 30 m accuracy):
 * coarse but free and without a key. Swapping to a finer source later only
 * means changing the constants below.
 */

import { NavigationControl, type Map as MapLibreMap } from "maplibre-gl";

const DEM_SOURCE = "dem";
/** Address of the altitude tiles ({z}, {x}, {y} are the zoom, column and row of a tile). */
export const DEM_TILE_TEMPLATE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const DEM_ATTRIBUTION = '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>';

/** The relief is stretched a little, so slopes read better on a screen. */
const EXAGGERATION = 1.2;
/** How far the camera tilts, in degrees (0 is straight down). Kept moderate: a flatter view sees further and loads more tiles. */
export const TILT_DEGREES = 60;

/**
 * Turn the 3D view on: add the altitudes, bend the map over them, tilt the camera.
 *
 * Safe to call again (for instance after the base map has changed): the
 * source is only added once.
 *
 * Parameters
 * ----------
 * map : Map
 *     The planning map, with its style loaded.
 * animate : bool
 *     Tilt smoothly (the default) or jump straight to the tilt.
 */
export function enableTerrain(map: MapLibreMap, animate = true): void {
  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, {
      type: "raster-dem",
      tiles: [DEM_TILE_TEMPLATE],
      encoding: "terrarium",
      tileSize: 256,
      // Deeper views are drawn from zoom-12 tiles: the data itself is only about 30 m accurate,
      // and the offline download only saves the relief up to this zoom (see offlineDownload.ts).
      maxzoom: 12,
      attribution: DEM_ATTRIBUTION,
    });
  }
  map.setTerrain({ source: DEM_SOURCE, exaggeration: EXAGGERATION });

  // Rotating and tilting are off in 2D (they only get in the way when planning).
  map.dragRotate.enable();
  map.touchPitch.enable();
  map.touchZoomRotate.enableRotation();
  // Moving the camera here would cut short any move already under way (such as the framing of the
  // parcours when its page opens): a map that is already tilted is left alone.
  if (Math.abs(map.getPitch() - TILT_DEGREES) > 1) map.easeTo({ pitch: TILT_DEGREES, duration: animate ? 800 : 0 });
}

/** Turn the 3D view off: flat map again, facing north. */
export function disableTerrain(map: MapLibreMap): void {
  map.setTerrain(null);
  map.dragRotate.disable();
  map.touchPitch.disable();
  map.touchZoomRotate.disableRotation();
  map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
}

/** The compass button, shown in 3D: it shows where north is, and a click puts the map back facing north. */
export function createCompass(): NavigationControl {
  return new NavigationControl({ showZoom: false, showCompass: true, visualizePitch: true });
}
