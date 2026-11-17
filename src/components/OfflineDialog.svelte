<!--
  Offline window of one saved parcours. Three faces, always titled "Mode hors réseau":

  - not downloaded: asks whether to download the parcours and its map to read
    them without network, with an option for the 3D relief;
  - downloading: a progress bar and a "Annuler" button;
  - downloaded: "available offline" in green, a "Supprimer" button, and a
    "Mettre à jour" button that is greyed unless the parcours was changed
    since the download (then it carries a green dot, like the buttons that
    lead here).

  The download saves the parcours and the Plan IGN map along its route (1 km
  each side). It goes on if the window is closed (open it again to see it or to
  cancel). If it fails, what was already saved is kept: trying again resumes.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "../lib/auth.svelte.js";
  import { feedback } from "../lib/feedback.svelte.js";
  import { library } from "../lib/library.svelte.js";
  import { offline } from "../lib/offline.svelte.js";
  import { connection } from "../lib/online.svelte.js";
  import type { ParcoursFile, ParcoursSummary } from "../lib/parcours";
  import * as storage from "../lib/storage";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let { item }: { item: ParcoursSummary } = $props();

  // `raw`: the parcours is only read, and must stay a plain object (the database cannot store a reactive proxy).
  let file = $state.raw<ParcoursFile | null>(null);
  let include3d = $state(false);
  let confirmingRemoval = $state(false);

  const record = $derived(offline.get(item.id));
  const running = $derived(offline.active?.id === item.id);
  const busyElsewhere = $derived(offline.active !== null && offline.active.id !== item.id);
  const updatable = $derived(offline.needsUpdate(item.id));
  // Never "100 %" while it is still working (the last files may be waiting for a new try).
  const percent = $derived(
    offline.active ? Math.min(99, Math.floor((offline.active.progress.done / offline.active.progress.total) * 100)) : 0,
  );
  const retrying = $derived((offline.active?.progress.retrying ?? 0) > 0);

  onMount(() => {
    // The route decides which tiles are needed: read the whole parcours.
    storage.loadParcours(item.id).then(
      (loaded) => (file = loaded),
      (error) => feedback.problem("lire le parcours", error),
    );
  });

  function close(): void {
    library.offlineFor = null;
  }

  /** Download, or update (an update keeps the choice made for the relief). */
  async function start(): Promise<void> {
    if (!file || !auth.user) return;
    try {
      await offline.download(file, auth.user.id, record?.include3d ?? include3d);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // cancelled on purpose
      feedback.problem("télécharger le parcours pour le mode hors réseau", error);
    }
  }

  async function remove(): Promise<void> {
    confirmingRemoval = false;
    try {
      await offline.remove(item.id);
    } catch (error) {
      feedback.problem("supprimer le téléchargement", error);
    }
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && !confirmingRemoval && close()} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) close();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="offline-title">
    <header>
      <h2 id="offline-title">Mode hors réseau</h2>
      <button type="button" class="close" aria-label="Fermer" onclick={close}>×</button>
    </header>

    {#if running}
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
        <span style:width="{percent}%"></span>
      </div>
      <p class="hint">Téléchargement en cours… {percent} %</p>
      {#if retrying}
        <p class="hint">Le serveur de cartes répond mal : nouvel essai…</p>
      {/if}
      <div class="actions">
        <button type="button" class="secondary" onclick={() => offline.cancel()}>Annuler</button>
      </div>
    {:else if record}
      <p class="status">✓ Parcours et carte disponibles hors réseau</p>
      {#if (record.missing ?? 0) > 0}
        <p class="hint">Quelques morceaux de carte n'ont pas pu être téléchargés : « Mettre à jour » réessaie.</p>
      {/if}
      <div class="actions">
        <button type="button" class="danger" onclick={() => (confirmingRemoval = true)}>Supprimer</button>
        <button
          type="button"
          class="primary"
          disabled={!updatable || !file || !connection.online || busyElsewhere}
          onclick={start}
        >
          Mettre à jour
          {#if updatable}<span class="dot" role="img" aria-label="Mise à jour disponible"></span>{/if}
        </button>
      </div>
    {:else}
      <p class="question">Veux-tu télécharger le parcours et sa carte pour le consulter sans réseau ?</p>
      <label class="check">
        <input type="checkbox" bind:checked={include3d} />
        Inclure le relief 3D
      </label>
      {#if !connection.online}
        <p class="warning">Il faut être connecté à internet pour télécharger.</p>
      {:else if busyElsewhere}
        <p class="warning">Un autre téléchargement est en cours.</p>
      {/if}
      <div class="actions">
        <button type="button" class="primary" disabled={!file || !connection.online || busyElsewhere} onclick={start}>
          Télécharger
        </button>
      </div>
    {/if}
  </div>
</div>

{#if confirmingRemoval}
  <ConfirmDialog
    title="Supprimer le téléchargement ?"
    message="La carte et la copie du parcours seront retirées de cet appareil. Le parcours reste enregistré en ligne."
    confirmLabel="Supprimer"
    onconfirm={remove}
    oncancel={() => (confirmingRemoval = false)}
  />
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(31, 42, 36, 0.45);
  }

  .dialog {
    width: min(400px, 100%);
    max-height: 100%;
    overflow-y: auto;
    padding: 18px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  h2 {
    margin: 0;
    font-family: var(--font-title);
    font-size: 20px;
  }

  .close {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .question {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.5;
  }

  .hint,
  .status,
  .warning {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
  }

  .status {
    color: var(--accent);
    font-weight: 600;
  }

  .warning {
    padding: 8px 10px;
    border-radius: 9px;
    background: #fbf1dc;
    color: #7a5600;
    font-size: 13px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 500;
  }

  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .bar {
    height: 10px;
    margin: 6px 0 10px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--border);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s ease;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  .actions button {
    position: relative;
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    border: none;
    background: var(--accent);
    color: #fff;
  }

  .secondary {
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text);
  }

  .danger {
    margin-right: auto;
    border: 1px solid #c0392b;
    background: #fff;
    color: #c0392b;
  }

  .actions button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* "An update is waiting": a small green dot on the corner, like a notification. */
  .dot {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    border: 2px solid var(--panel);
    border-radius: 50%;
    background: #2ea043;
  }
</style>
