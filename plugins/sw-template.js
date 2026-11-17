/*
 * Service worker of Hiker's Notebook.
 *
 * A service worker is a small program the browser keeps next to the site. It
 * sees every request the page makes and may answer it itself, which is what
 * makes the app work without network. This file is a template: at build time
 * the plugin in plugins/serviceWorker.ts fills in the list of files and a
 * version, and writes the result as `sw.js` next to the site.
 *
 * It does two jobs:
 *
 * 1. The app itself ("shell": page, scripts, styles, fonts, icons). All of it
 *    is saved at install time, so the site opens with no network. A new
 *    version of the site installs a new worker next to the old one, and takes
 *    over the next time the app is opened (never in the middle of a session).
 *
 * 2. The map data (tiles, styles, fonts of the maps). Tiles saved by the
 *    "download for offline use" feature live in caches named `offline-...`
 *    and `overview`; a request for a saved tile is answered from there, other
 *    requests go to the network. The files that describe a map (style and
 *    TileJSON) are asked from the network first, so they stay up to date, and
 *    the saved copy is only used when the network fails.
 *
 * Testing without network: the page can send {type: "SET_OFFLINE_TEST"} to
 * make every request that is not answered from a cache fail, as if the
 * device were offline.
 */

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;

const SHELL_CACHE = `shell-${VERSION}`;
const FLAGS_CACHE = "flags";
const OFFLINE_TEST_KEY = "offline-test";
/** After this long without an answer, a page is served from the saved copy instead. */
const NAVIGATION_TIMEOUT_MS = 4000;

const scope = self.registration.scope;
const url = (path) => new URL(path, scope).href;

let offlineTest = null; // null = not read yet

async function isOfflineTest() {
  if (offlineTest === null) {
    const cache = await caches.open(FLAGS_CACHE);
    offlineTest = (await cache.match(OFFLINE_TEST_KEY)) !== undefined;
  }
  return offlineTest;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([url("./"), ...PRECACHE.map(url)])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Forget the saved files of older versions of the app.
      for (const name of await caches.keys()) {
        if (name.startsWith("shell-") && name !== SHELL_CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "SKIP_WAITING") {
    // Take over now instead of at the next start of the app (used by tests, and by a future "update" button).
    self.skipWaiting();
    return;
  }
  if (!message || message.type !== "SET_OFFLINE_TEST") return;
  event.waitUntil(
    (async () => {
      offlineTest = Boolean(message.value);
      const cache = await caches.open(FLAGS_CACHE);
      if (offlineTest) await cache.put(OFFLINE_TEST_KEY, new Response("1"));
      else await cache.delete(OFFLINE_TEST_KEY);
    })(),
  );
});

/** Which map service a request goes to, or ``null`` if it is not map data. */
function mapService(address) {
  const { hostname, pathname } = address;
  if (hostname === "data.geopf.fr" && (pathname.startsWith("/tms/") || pathname.startsWith("/annexes/ressources/vectorTiles/"))) {
    return "ign";
  }
  if (hostname === "tiles.openfreemap.org") return "openfreemap";
  if (hostname === "s3.amazonaws.com" && pathname.startsWith("/elevation-tiles-prod/")) return "relief";
  return null;
}

/** Files that describe a map (they change over time): style and TileJSON. */
function isMapDescription(address) {
  return /\/(metadata|standard)\.json$/.test(address.pathname) || address.pathname === "/planet";
}

/** The network, unless the test mode pretends there is none. */
async function network(request) {
  if (await isOfflineTest()) throw new TypeError("Offline (test mode)");
  return fetch(request);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

async function answerSameOrigin(request) {
  if (request.method !== "GET") return network(request);

  if (request.mode === "navigate") {
    try {
      return await withTimeout(network(request), NAVIGATION_TIMEOUT_MS);
    } catch (error) {
      const saved = await caches.match(url("index.html"), { cacheName: SHELL_CACHE });
      if (saved) return saved;
      throw error;
    }
  }

  // ignoreVary: a server may say the answer depends on a header (such as Origin) that only some requests carry.
  const saved = await caches.match(request, { cacheName: SHELL_CACHE, ignoreSearch: true, ignoreVary: true });
  return saved ?? network(request);
}

async function answerMapData(request, address) {
  if (isMapDescription(address)) {
    try {
      return await network(request);
    } catch (error) {
      const saved = await caches.match(request, { ignoreVary: true });
      if (saved) return saved;
      throw error;
    }
  }
  // A tile, sprite or font: the saved copy first (instant, and works offline).
  const saved = await caches.match(request, { ignoreVary: true });
  return saved ?? network(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const address = new URL(request.url);

  if (address.origin === location.origin) {
    event.respondWith(answerSameOrigin(request));
  } else if (request.method === "GET" && mapService(address)) {
    event.respondWith(answerMapData(request, address));
  } else {
    // Anything else (accounts, weather, routing...) goes to the network as usual.
    event.respondWith(network(request));
  }
});
