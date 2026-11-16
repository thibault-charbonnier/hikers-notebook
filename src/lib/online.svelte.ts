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

  constructor() {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => (this.online = true));
    window.addEventListener("offline", () => (this.online = false));
  }
}

export const connection = new Connection();
