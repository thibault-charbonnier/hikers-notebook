/**
 * Where parcours and labels are saved and read: the Supabase database.
 *
 * Without network, reading falls back on what was saved on this device (see
 * ``offlineStore.ts``): only the parcours downloaded for offline use, and
 * the labels as they were at the last visit. Writing needs the network.
 *
 * Every row belongs to the logged-in person, and the database itself refuses
 * to show or change anyone else's rows (see the Row Level Security rules).
 * Everything else in the app goes through these functions only.
 *
 * Mapping between a ``ParcoursFile`` and its row in the ``parcours`` table:
 * the figures used by lists and by the overview map are ordinary columns; the
 * heavy part (points, stretches of route, points of interest) is one JSON
 * column, ``data``, read only when a parcours is opened.
 */

import { auth } from "./auth.svelte.js";
import type { Stats } from "./geo";
import { connection } from "./online.svelte.js";
import { getDownload, getMeta, labelsKey, listDownloads, setMeta } from "./offlineStore";
import type { Label, ParcoursFile, ParcoursSummary, ParcoursType } from "./parcours";
import { supabase } from "./supabase";

/** The columns of the ``parcours`` table, without the heavy ``data`` column. */
const SUMMARY_COLUMNS =
  "id, name, description, type, done, done_on, done_comment, rating, labels, color, stages, created_at, updated_at, stats, preview, closed, shared_by";

/** A row of the ``parcours`` table, as Supabase returns it. */
interface ParcoursRow {
  id: string;
  name: string;
  description: string;
  type: ParcoursType;
  done: boolean;
  done_on: string | null;
  done_comment: string;
  rating: number | string | null;
  labels: string[];
  color: string;
  stages: number;
  created_at: string;
  updated_at: string;
  stats: Stats;
  preview: string;
  closed: boolean;
  shared_by: string | null;
  data?: Pick<ParcoursFile, "waypoints" | "segments" | "pois">;
}

/** Turn an error of Supabase into a normal ``Error`` (or return if there is none). */
function check(error: { message: string } | null): void {
  if (error) throw new Error(`Storage error: ${error.message}`);
}

/** The id of the logged-in person (needed to write a row of their own). */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not logged in");
  return id;
}

/** Rebuild the light summary of a parcours from its row. */
function toSummary(row: ParcoursRow): ParcoursSummary {
  return {
    version: 1,
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    done: row.done,
    doneOn: row.done_on,
    doneComment: row.done_comment,
    rating: row.rating === null ? null : Number(row.rating),
    labels: row.labels,
    color: row.color,
    stages: row.stages,
    // The database writes dates its own way; put them back in the app's way.
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    stats: row.stats,
    preview: row.preview,
    closed: row.closed,
    sharedBy: row.shared_by,
  };
}

/** The account whose offline copies are used. */
const accountId = (): string => auth.user?.id ?? "";

/** List all saved parcours, without their heavy parts (offline: only the downloaded ones). */
export async function listParcours(): Promise<ParcoursSummary[]> {
  if (!connection.online) return (await listDownloads(accountId())).map((record) => record.summary);
  const { data, error } = await supabase.from("parcours").select(SUMMARY_COLUMNS);
  check(error);
  return (data as unknown as ParcoursRow[]).map(toSummary);
}

/** The copy of a parcours saved on this device, if this account downloaded it. */
async function downloadedCopy(id: string): Promise<ParcoursFile | undefined> {
  const record = await getDownload(id);
  return record && record.userId === accountId() ? record.file : undefined;
}

/** Read one whole parcours (without network: the downloaded copy). */
export async function loadParcours(id: string): Promise<ParcoursFile> {
  if (!connection.online) {
    const copy = await downloadedCopy(id);
    if (copy) return copy;
    throw new Error("Not available offline: this parcours was not downloaded");
  }
  const { data, error } = await supabase.from("parcours").select(`${SUMMARY_COLUMNS}, data`).eq("id", id).single();
  if (error) {
    // The network looked fine but the server could not be reached: use the copy if there is one.
    const copy = await downloadedCopy(id);
    if (copy) return copy;
  }
  check(error);
  const row = data as unknown as ParcoursRow;
  return {
    ...toSummary(row),
    waypoints: row.data?.waypoints ?? [],
    segments: row.data?.segments ?? [],
    pois: row.data?.pois ?? [],
  };
}

/** Create or replace a parcours. */
export async function saveParcours(file: ParcoursFile): Promise<void> {
  const row = {
    id: file.id,
    user_id: await currentUserId(),
    version: file.version,
    name: file.name,
    description: file.description,
    type: file.type,
    done: file.done,
    done_on: file.doneOn,
    done_comment: file.doneComment,
    rating: file.rating ?? null,
    labels: file.labels,
    color: file.color,
    stages: file.stages ?? 1,
    created_at: file.createdAt,
    updated_at: file.updatedAt,
    stats: file.stats,
    preview: file.preview,
    closed: file.closed,
    data: { waypoints: file.waypoints, segments: file.segments, pois: file.pois ?? [] },
  };
  const { error } = await supabase.from("parcours").upsert(row, { onConflict: "id" });
  check(error);
}

/** Delete a parcours. */
export async function deleteParcours(id: string): Promise<void> {
  const { error } = await supabase.from("parcours").delete().eq("id", id);
  check(error);
}

/** Read the list of labels, in the order the person arranged them (without network: as at the last visit). */
export async function loadLabels(): Promise<Label[]> {
  if (!connection.online) return (await getMeta<Label[]>(labelsKey(accountId()))) ?? [];
  const { data, error } = await supabase.from("labels").select("name, color").order("position");
  check(error);
  const labels = data ?? [];
  // Keep a copy for the next time there is no network (a failure here must not matter).
  void setMeta(labelsKey(accountId()), labels).catch(() => {});
  return labels;
}

/** Replace the list of labels. */
export async function saveLabels(labels: Label[]): Promise<void> {
  const userId = await currentUserId();

  // Write the new list first, then remove what is no longer in it: if the
  // second step fails, nothing is lost.
  if (labels.length > 0) {
    const rows = labels.map((label, position) => ({ user_id: userId, name: label.name, color: label.color, position }));
    const { error } = await supabase.from("labels").upsert(rows, { onConflict: "user_id,name" });
    check(error);
  }
  const { data: existing, error: readError } = await supabase.from("labels").select("name");
  check(readError);
  const kept = new Set(labels.map((label) => label.name));
  const stale = (existing ?? []).map((row) => row.name).filter((name) => !kept.has(name));
  if (stale.length > 0) {
    const { error } = await supabase.from("labels").delete().in("name", stale);
    check(error);
  }
}
