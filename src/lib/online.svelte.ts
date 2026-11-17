/**
 * Whether the device is connected to the internet.
 *
 * The browser tells it with ``navigator.onLine`` and the ``online`` /
 * ``offline`` events, so the value updates by itself when the connection
 * comes back or goes away.
 */

class Connection {
  /** ``true`` when the browser thinks it is online. */
  online = $state(typeof navigator === "undefined" ? true : navigator.onLine);
  /** True while the offline mode is only being tested (see ``simulateOffline``). */
  simulated = $state(false);

  constructor() {
    if (typeof window === "undefined") return;
    // A test of the offline mode (see serviceWorker.ts) survives a reload of the page.
    try {
      if (sessionStorage.getItem("simulateOffline")) this.simulate(true);
    } catch {
      // private mode: nothing to restore
    }
    window.addEventListener("online", () => (this.online = !this.simulated));
    window.addEventListener("offline", () => (this.online = false));
  }

  /** Pretend the network is gone (``true``), or give the real state back (``false``). */
  simulate(offline: boolean): void {
    this.simulated = offline;
    this.online = offline ? false : navigator.onLine;
  }
}

export const connection = new Connection();
