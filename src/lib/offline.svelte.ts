/**
 * The offline mode, as the interface sees it: which parcours are saved on
 * this device, the download in progress, and the actions on them.
 *
 * The heavy lifting is in ``offlineDownload.ts`` (the map files) and
 * ``offlineStore.ts`` (the records); this class keeps the list in memory so
 * components can react to it.
 */

import {
  downloadForOffline,
  removeOfflineFiles,
  type DownloadProgress,
} from "./offlineDownload";
import { library } from "./library.svelte.js";
import { deleteDownload, listDownloads, putDownload, type DownloadRecord } from "./offlineStore";
import type { ParcoursFile } from "./parcours";

class Offline {
  /** The parcours saved on this device, for the logged-in account. */
  downloads = $state.raw<DownloadRecord[]>([]);
  /** The download in progress, if any (only one at a time). */
  active = $state<{ id: string; progress: DownloadProgress } | null>(null);

  #controller: AbortController | null = null;

  /** The light summaries of the saved parcours, for the list. */
  summaries = $derived(this.downloads.map((record) => record.summary));

  /** Read the saved parcours of an account (or forget them when nobody is logged in). */
  async load(userId: string | null): Promise<void> {
    this.downloads = userId ? await listDownloads(userId) : [];
  }

  has(id: string): boolean {
    return this.downloads.some((record) => record.id === id);
  }

  get(id: string): DownloadRecord | undefined {
    return this.downloads.find((record) => record.id === id);
  }

  /**
   * Tell whether the parcours was changed after it was downloaded.
   *
   * Every save of a parcours writes the date and time of the save (to the
   * millisecond) in its "updatedAt". The copy on the device remembers the date
   * it was made from: if the one in the database is different, the copy is out
   * of date. Without network the list is made of the copies themselves, so
   * nothing can be out of date.
   */
  needsUpdate(id: string): boolean {
    const record = this.get(id);
    const current = library.items.find((item) => item.id === id);
    if (!record) return false;
    // A copy with holes (tiles that failed) can also be improved by updating it.
    return (record.missing ?? 0) > 0 || Boolean(current && current.updatedAt !== record.summary.updatedAt);
  }

  /**
   * Save a parcours and its map for offline use.
   *
   * Parameters
   * ----------
   * file : ParcoursFile
   *     The parcours, as it is in the database.
   * userId : str
   *     The logged-in account.
   * include3d : bool
   *     Whether to include the relief tiles.
   *
   * Raises
   * ------
   * Error
   *     If the download fails or is cancelled (nothing is kept then).
   */
  async download(file: ParcoursFile, userId: string, include3d: boolean): Promise<void> {
    if (this.active) throw new Error("A download is already running");
    const controller = new AbortController();
    this.#controller = controller;
    this.active = { id: file.id, progress: { done: 0, total: 1, bytes: 0, retrying: 0 } };
    // Ask the browser not to clear these files when it needs room (it may refuse).
    void navigator.storage?.persist?.();
    try {
      const result = await downloadForOffline(file, {
        include3d,
        signal: controller.signal,
        onProgress: (progress) => {
          if (this.active) this.active.progress = progress;
        },
      });
      // A plain copy: a reactive object cannot be stored in the database.
      const plain = $state.snapshot(file) as ParcoursFile;
      const record: DownloadRecord = {
        id: file.id,
        userId,
        name: file.name,
        summary: summaryFrom(plain),
        file: plain,
        downloadedAt: new Date().toISOString(),
        include3d,
        fileCount: result.fileCount,
        bytes: result.bytes,
        cacheName: result.cacheName,
        missing: result.missing,
      };
      try {
        await putDownload(record);
      } catch (error) {
        await removeOfflineFiles(file.id); // do not keep map files that nothing refers to
        throw error;
      }
      this.downloads = [...this.downloads.filter((r) => r.id !== file.id), record];
    } catch (error) {
      // Whatever stopped the work, if the person cancelled it is a cancellation, not a failure.
      if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      throw error;
    } finally {
      this.active = null;
      this.#controller = null;
    }
  }

  /** Cancel the download in progress. */
  cancel(): void {
    this.#controller?.abort();
  }

  /** Remove a saved parcours and its map files from this device. */
  async remove(id: string): Promise<void> {
    await removeOfflineFiles(id);
    await deleteDownload(id);
    this.downloads = this.downloads.filter((record) => record.id !== id);
  }
}

/** The summary of a parcours: the file without its heavy parts. */
function summaryFrom(file: ParcoursFile): DownloadRecord["summary"] {
  const { waypoints, segments, pois, ...summary } = file;
  return summary;
}

/** The offline mode shared by all components. */
export const offline = new Offline();
