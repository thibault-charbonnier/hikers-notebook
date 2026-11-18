/**
 * Sharing a parcours by a link.
 *
 * How it works, in short:
 *
 * - the owner asks for a link: the database keeps a frozen copy (a "snapshot")
 *   of the parcours as it is at that moment, under a secret word (the "token").
 *   The link is the address of the app followed by it:
 *   ``https://.../#/shared/<token>``. Later changes to the parcours do not
 *   change what the link gives, and a link is never turned off;
 * - whoever opens the link, once logged in, gets a **copy** of that snapshot in
 *   their own account, tagged with the first name of the sender (the copy
 *   shows in the "Parcours partagés" section of the list). The labels, the
 *   "done" state, date, rating and comment of the sender are not copied. Opening
 *   the link twice does not copy twice;
 *
 * The rules that make this safe are in the database (the ``*_share_*``
 * functions): this file only calls them.
 */

import { supabase } from "./supabase";

/** What a link leads to, as far as anyone holding it may know. */
export interface SharePreview {
  name: string;
  type: string;
  distanceM: number;
  sharedBy: string | null;
}

/** The full address of a share link. */
export function shareUrl(token: string): string {
  return `${location.origin}${location.pathname}#/shared/${token}`;
}

/** Freeze one of my parcours as it is now and return the token of the link (the same one if nothing changed). */
export async function createShareLink(parcoursId: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_share_link", { p_parcours_id: parcoursId });
  if (error) throw new Error(`Share error: ${error.message}`);
  return data as string;
}

/** Name and size of what a link leads to, or ``null`` if the link is not valid. Works without an account. */
export async function sharePreview(token: string): Promise<SharePreview | null> {
  const { data, error } = await supabase.rpc("shared_parcours_preview", { p_token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return { name: row.name, type: row.type, distanceM: Number(row.distance_m), sharedBy: row.shared_by };
}

/** Raised when a link does not lead anywhere (mistyped or incomplete). */
export class InvalidShareLink extends Error {}

/**
 * Open a link: make a copy of the parcours in my account.
 *
 * Returns
 * -------
 * str
 *     The id of the parcours that is now mine (an earlier copy if there was one).
 *
 * Raises
 * ------
 * InvalidShareLink
 *     If the link does not exist.
 */
export async function receiveShared(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("receive_shared_parcours", { p_token: token });
  if (error) {
    if (error.message.includes("Invalid share link")) throw new InvalidShareLink();
    throw new Error(`Share error: ${error.message}`);
  }
  return data as string;
}

const PENDING_KEY = "hikers-notebook-pending-share";

/**
 * The link opened by someone who is not logged in yet. It is kept in the
 * browser so it survives the sign-up (which may go through an e-mail and a
 * reload of the page) and is used as soon as the person is in.
 */
export const pendingShare = {
  get(): string | null {
    try {
      return localStorage.getItem(PENDING_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(PENDING_KEY, token);
    } catch {
      // not allowed: the link only works while the page stays open
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      // nothing to clear
    }
  },
};
