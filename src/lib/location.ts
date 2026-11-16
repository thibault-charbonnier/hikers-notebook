/**
 * Show the user's position on a map as a small blue dot.
 *
 * Nothing is recorded: the position is only displayed. It relies on the
 * device GPS, so it keeps working without a network connection.
 */

import { Marker, type Map as MapLibreMap } from "maplibre-gl";

/**
 * Start following the device position and draw it on the map.
 *
 * The dot appears as soon as a position is known. It stays at the last known
 * position if the signal is lost, and disappears if the browser permission is
 * refused.
 *
 * Parameters
 * ----------
 * map : Map
 *     The map the dot is drawn on.
 *
 * Returns
 * -------
 * function
 *     Call it to stop following the position and remove the dot.
 */
export function showUserLocation(map: MapLibreMap): () => void {
  if (!("geolocation" in navigator)) return () => {};

  const element = document.createElement("div");
  element.className = "user-dot";
  const marker = new Marker({ element });
  let isOnMap = false;

  const watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      marker.setLngLat([coords.longitude, coords.latitude]);
      if (!isOnMap) {
        marker.addTo(map);
        isOnMap = true;
      }
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        marker.remove();
        isOnMap = false;
      }
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    marker.remove();
  };
}
