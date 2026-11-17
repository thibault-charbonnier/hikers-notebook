/**
 * The device-side memory of the offline mode, kept in IndexedDB (the
 * browser's small built-in database).
 *
 * Two kinds of things live here:
 *
 * - **downloads**: one record per parcours saved for offline use. It holds the
 *   whole parcours (so it can be opened without network), its summary (for
 *   the list), and facts about what was downloaded. The map tiles themselves
 *   are not here but in the browser's file cache, in a cache named after the
 *   parcours (see ``offlineDownload.ts``);
 * - **meta**: small notes, such as the labels as they were the last time the
 *   app was online, and whether the overview map has been saved.
 *
 * Every record is tagged with the account it belongs to, so that two people
 * using the same phone never see each other's downloads.
 */

import type { Label, ParcoursFile, ParcoursSummary } from "./parcours";

/** A parcours saved for offline use. */
export interface DownloadRecord {
  id: string;
  /** The account that downloaded it. */
  userId: string;
  name: string;
  summary: ParcoursSummary;
  /** The whole parcours, as read from the database at download time. */
  file: ParcoursFile;
  /** ISO date and time of the download. */
  downloadedAt: string;
  /** True if the relief (3D) tiles were included. */
  include3d: boolean;
  /** Number of files saved in the cache. */
  fileCount: number;
  /** Total size of what was saved, in bytes. */
  bytes: number;
  /** Name of the cache that holds the map files. */
  cacheName: string;
  /** Tiles that could not be downloaded (a few are tolerated; "Mettre à jour" tries them again). */
  missing?: number;
}

const DATABASE = "hikers-notebook";
const VERSION = 1;
const DOWNLOADS = "downloads";
const META = "meta";

let opening: Promise<IDBDatabase> | null = null;

/** Open the database (creating it the first time). */
function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DOWNLOADS, { keyPath: "id" });
      request.result.createObjectStore(META, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

/** Run one request on a store and wait for its answer. */
async function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** All the downloads of one account. */
export async function listDownloads(userId: string): Promise<DownloadRecord[]> {
  const all = await run<DownloadRecord[]>(DOWNLOADS, "readonly", (s) => s.getAll());
  return all.filter((record) => record.userId === userId);
}

/** One download, or ``undefined``. */
export function getDownload(id: string): Promise<DownloadRecord | undefined> {
  return run<DownloadRecord | undefined>(DOWNLOADS, "readonly", (s) => s.get(id));
}

/** Create or replace a download. */
export async function putDownload(record: DownloadRecord): Promise<void> {
  await run(DOWNLOADS, "readwrite", (s) => s.put(record));
}

/** Forget a download (its map files are removed separately). */
export async function deleteDownload(id: string): Promise<void> {
  await run(DOWNLOADS, "readwrite", (s) => s.delete(id));
}

/** Read a small note. */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await run<{ key: string; value: T } | undefined>(META, "readonly", (s) => s.get(key));
  return row?.value;
}

/** Write a small note. */
export async function setMeta(key: string, value: unknown): Promise<void> {
  await run(META, "readwrite", (s) => s.put({ key, value }));
}

/** Key of the note that holds the labels of an account. */
export const labelsKey = (userId: string) => `labels:${userId}`;

export type { Label };
