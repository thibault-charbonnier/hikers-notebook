/**
 * Show the user's position on a map as a small blue dot.
 *
 * Nothing is recorded: the position is only displayed. It relies on the
 * device GPS, so it keeps working without a network connection. When the
 * compass of the map is following the phone's heading (see MapCompass.svelte),
 * a light beam shows the direction the phone faces, like Google Maps.
 */

import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { heading } from "./heading.svelte";

/**
 * Listen to the compass sensor of the phone, if it has one, so the beam can be drawn.
 *
 * Android gives access straight away. An iPhone only after the person agrees,
 * and the question can only be asked from a tap: it is asked at the first tap on
 * the map. If there is no sensor, or the person says no, nothing is drawn.
 *
 * Returns
 * -------
 * function
 *     Call it to stop listening.
 */
function listenToHeading(container: HTMLElement): () => void {
  if (!heading.available) return () => {};
  const needsTap = typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
  const ask = (): void => void heading.start();
  if (needsTap) container.addEventListener("pointerup", ask, { once: true });
  else ask();
  return () => {
    container.removeEventListener("pointerup", ask);
    heading.stop();
  };
}

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
  element.className = "user-dot-wrap";
  const cone = document.createElement("div");
  cone.className = "user-dot-cone";
  const dot = document.createElement("div");
  dot.className = "user-dot";
  element.append(cone, dot);
  const marker = new Marker({ element });
  let isOnMap = false;

  // The beam points where the phone faces, whatever the way the map is turned.
  const drawBeam = (): void => {
    const facing = heading.active ? heading.degrees : null;
    cone.style.display = facing === null ? "none" : "block";
    if (facing !== null) cone.style.transform = `rotate(${facing - map.getBearing()}deg)`;
  };
  const stopBeam = heading.onChange(drawBeam);
  const stopHeading = listenToHeading(map.getContainer());
  map.on("rotate", drawBeam);
  drawBeam();

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
    stopHeading();
    stopBeam();
    map.off("rotate", drawBeam);
    marker.remove();
  };
}
