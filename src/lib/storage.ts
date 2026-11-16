/**
 * Where parcours are saved and read.
 *
 * Today this talks to the small API of the development server (see
 * ``server/devStorage.ts``), which keeps JSON files in the ``data/`` folder.
 * It only works with ``npm run dev``. Everything else in the app goes through
 * these functions, so the storage can be replaced without touching the rest.
 */

import type { Label, ParcoursFile, ParcoursSummary } from "./parcours";

/**
 * Send a request to the storage API.
 *
 * Raises
 * ------
 * Error
 *     If the API is unreachable (for instance in the built site) or answers
 *     with an error.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, init);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  if (!response.ok || !isJson) throw new Error(`Storage unavailable (HTTP ${response.status})`);
  return response.json();
}

const asJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** List all saved parcours, without their heavy parts. */
export function listParcours(): Promise<ParcoursSummary[]> {
  return request("parcours");
}

/** Read one whole parcours. */
export function loadParcours(id: string): Promise<ParcoursFile> {
  return request(`parcours/${id}`);
}

/** Create or replace a parcours. */
export async function saveParcours(file: ParcoursFile): Promise<void> {
  await request(`parcours/${file.id}`, asJson("PUT", file));
}

/** Delete a parcours. */
export async function deleteParcours(id: string): Promise<void> {
  await request(`parcours/${id}`, { method: "DELETE" });
}

/** Read the list of labels. */
export function loadLabels(): Promise<Label[]> {
  return request("labels");
}

/** Replace the list of labels. */
export async function saveLabels(labels: Label[]): Promise<void> {
  await request("labels", asJson("PUT", labels));
}
