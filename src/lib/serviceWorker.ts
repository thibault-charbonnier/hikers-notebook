/**
 * Registration of the service worker (see plugins/sw-template.js), and the
 * switch used to test the app without network.
 *
 * The worker only exists in the built site: in development the file is not
 * produced, so nothing is registered.
 */

import { connection } from "./online.svelte.js";

/** Register the service worker, once the page has finished loading. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.error("Service worker failed", error));
  });
}

/**
 * Pretend there is no network, or stop pretending.
 *
 * The page believes it is offline, and the service worker makes every request
 * that it cannot answer from a saved copy fail. It lets the offline mode be
 * tested on a computer that is, in fact, online. Reachable from the browser
 * console as ``simulateOffline(true)`` / ``simulateOffline(false)``.
 *
 * Parameters
 * ----------
 * offline : bool
 *     True to simulate the loss of the network.
 */
export async function simulateOffline(offline: boolean): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "SET_OFFLINE_TEST", value: offline });
  connection.simulate(offline);
  try {
    sessionStorage.setItem("simulateOffline", offline ? "1" : "");
  } catch {
    // private mode: the switch simply does not survive a reload
  }
}

(window as unknown as { simulateOffline: typeof simulateOffline }).simulateOffline = simulateOffline;
