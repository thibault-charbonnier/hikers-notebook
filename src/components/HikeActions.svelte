<!--
  Small bar of actions on the parcours, at the bottom left of the planning map,
  above the scale (on a phone too, above the closed sheet). From top to bottom:

  - the 3D button (dark green while the 3D view is on), then a separator;
  - download for offline use (opens the offline window; green when done);
  - export as a GPX file (works like any download, after a confirmation);
  - share by a link (see sharing.ts);
  - a separator, then the red bin, which asks before deleting.

  Deleting a saved parcours erases it for good and goes back to the overview.
  A parcours that was never saved is simply cleared. On a phone the bar hides
  while the hike details are open.
-->
<script lang="ts">
  import { exportCurrentGpx, openOfflineWindow, removeParcours, shareParcours } from "../lib/actions";
  import { feedback } from "../lib/feedback.svelte.js";
  import { hike } from "../lib/hike.svelte.js";
  import { offline } from "../lib/offline.svelte.js";
  import { ui } from "../lib/ui.svelte.js";
  import { viewport } from "../lib/viewport.svelte.js";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let confirming = $state(false);
  let confirmingGpx = $state(false);

  const canDelete = $derived(hike.isSaved || hike.points.length > 0);

  /** The link gives the saved version of the parcours, so it must be saved and unchanged. */
  function share(): void {
    if (!hike.isSaved || hike.dirty) {
      feedback.info(
        "Enregistre d'abord",
        "Enregistre le parcours, sans modification en attente, avant de le partager : le lien donne la version enregistrée.",
      );
      return;
    }
    void shareParcours(hike.id, hike.name);
  }

  /** The download saves what is in the database, so the parcours must be saved and unchanged. */
  function openOffline(): void {
    if (!hike.isSaved || hike.dirty) {
      feedback.info(
        "Enregistre d'abord",
        "Enregistre le parcours, sans modification en attente, avant de le télécharger pour le mode hors réseau.",
      );
      return;
    }
    openOfflineWindow(hike.id);
  }

  async function confirmDelete(): Promise<void> {
    confirming = false;
    if (hike.isSaved) {
      if (!(await removeParcours(hike.id))) return; // the person has been told why
      location.hash = "#/";
    } else {
      hike.reset();
    }
  }
</script>

{#if !(viewport.phone && ui.detailsOpen)}
<div class="actions" role="toolbar" aria-label="Actions sur le parcours">
  <button
    type="button"
    class="three-d"
    class:on={ui.viewMode === "3d"}
    aria-pressed={ui.viewMode === "3d"}
    aria-label="Vue 3D"
    title={ui.viewMode === "3d" ? "Revenir à la vue 2D" : "Vue 3D : relief (clic droit glissé ou deux doigts pour tourner)"}
    onclick={() => (ui.viewMode = ui.viewMode === "3d" ? "2d" : "3d")}
  >
    3D
  </button>

  <hr />

  <button
    type="button"
    class:saved={offline.has(hike.id)}
    aria-label="Mode hors réseau"
    title={offline.has(hike.id) ? "Disponible hors réseau" : "Télécharger pour le mode hors réseau"}
    onclick={openOffline}
  >
    {#if offline.needsUpdate(hike.id)}<span class="dot" role="img" aria-label="Mise à jour disponible"></span>{/if}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 13v8l-4-4" /><path d="m12 21 4-4" />
      <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
    </svg>
  </button>
  <button type="button" aria-label="Exporter en GPX" title="Exporter en GPX" disabled={!hike.stats} onclick={() => (confirmingGpx = true)}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  </button>
  <button type="button" aria-label="Partager le parcours" title="Partager le parcours" onclick={share}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  </button>

  <hr />

  <button
    type="button"
    class="danger"
    aria-label="Supprimer le parcours"
    title="Supprimer le parcours"
    disabled={!canDelete}
    onclick={() => (confirming = true)}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  </button>
</div>
{/if}

{#if confirmingGpx}
  <ConfirmDialog
    title="Exporter en GPX"
    message={`Veux-tu télécharger « ${hike.name} » au format .gpx ?`}
    confirmLabel="Télécharger"
    tone="primary"
    onconfirm={() => {
      confirmingGpx = false;
      exportCurrentGpx();
    }}
    oncancel={() => (confirmingGpx = false)}
  />
{/if}

{#if confirming}
  <ConfirmDialog
    title={hike.isSaved ? "Supprimer ce parcours ?" : "Effacer ce parcours ?"}
    message={hike.isSaved
      ? `« ${hike.name} » sera supprimé définitivement. Il n'y a pas de retour en arrière.`
      : "Ce parcours n'est pas encore enregistré : il sera effacé de l'écran."}
    confirmLabel={hike.isSaved ? "Supprimer" : "Effacer"}
    onconfirm={confirmDelete}
    oncancel={() => (confirming = false)}
  />
{/if}

<style>
  .actions {
    position: absolute;
    left: 16px;
    bottom: 52px; /* above the map scale */
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(31, 42, 36, 0.15);
  }

  hr {
    width: 28px;
    margin: 2px auto;
    border: none;
    border-top: 1px solid var(--border);
  }

  button {
    position: relative;
    width: 44px;
    height: 44px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: var(--accent-soft);
  }

  button:disabled {
    color: #b9bdb6;
    cursor: default;
  }

  /* The 3D button: its letters look extruded; dark green while the 3D view is on. */
  .three-d {
    font-family: var(--font-title);
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--accent);
    text-shadow:
      1px 1px 0 rgba(47, 93, 70, 0.35),
      2px 2px 0 rgba(47, 93, 70, 0.2);
  }

  .three-d.on {
    background: var(--accent);
    color: #fff;
    text-shadow:
      1px 1px 0 rgba(0, 0, 0, 0.35),
      2px 2px 0 rgba(0, 0, 0, 0.2);
  }

  .three-d.on:hover:not(:disabled) {
    background: #244a38;
  }

  /* "An update is waiting": a small green dot on the corner, like a notification. */
  .dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 12px;
    height: 12px;
    border: 2px solid var(--panel);
    border-radius: 50%;
    background: #2ea043;
  }

  /* Already downloaded for offline use. */
  .saved {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .danger {
    color: #c0392b;
  }

  .danger:hover:not(:disabled) {
    background: #fbe9e6;
  }

  .danger:disabled {
    color: #e3b4ae;
  }

  /* Phone: bottom left, above the map scale and the closed sheet. */
  @media (max-width: 720px) {
    .actions {
      left: 8px;
      bottom: 104px;
    }
  }
</style>
