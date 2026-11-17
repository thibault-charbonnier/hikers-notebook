<!--
  Options window of a saved parcours, opened by the cog next to it in the list:
  the same actions as on the planning page (offline download, GPX export,
  delete), without opening the parcours.
-->
<script lang="ts">
  import { exportGpxOf, openOfflineWindow, removeParcours } from "../lib/actions";
  import { library } from "../lib/library.svelte.js";
  import { offline } from "../lib/offline.svelte.js";
  import type { ParcoursSummary } from "../lib/parcours";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let { item }: { item: ParcoursSummary } = $props();

  let confirming = $state(false);
  let confirmingGpx = $state(false);
  let busy = $state(false);

  function close(): void {
    library.optionsFor = null;
  }

  async function exportGpx(): Promise<void> {
    confirmingGpx = false;
    busy = true;
    await exportGpxOf(item.id);
    busy = false;
    close();
  }

  async function confirmDelete(): Promise<void> {
    confirming = false;
    busy = true;
    const done = await removeParcours(item.id);
    busy = false;
    if (done) close();
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && !confirming && !confirmingGpx && close()} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) close();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="options-title">
    <header>
      <span class="swatch" style:background={item.color}></span>
      <h2 id="options-title">{item.name}</h2>
      <button type="button" class="close" aria-label="Fermer" onclick={close}>×</button>
    </header>

    <button
      type="button"
      class="option"
      disabled={busy}
      onclick={() => {
        const id = item.id; // closing this window clears `item`
        close();
        openOfflineWindow(id);
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 13v8l-4-4" /><path d="m12 21 4-4" />
        <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
      </svg>
      Mode hors réseau
      {#if offline.needsUpdate(item.id)}<span class="dot" role="img" aria-label="Mise à jour disponible"></span>{/if}
    </button>
    <button type="button" class="option" disabled={busy} onclick={() => (confirmingGpx = true)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
      </svg>
      Exporter en GPX
    </button>

    <hr />

    <button type="button" class="option danger" disabled={busy} onclick={() => (confirming = true)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      Supprimer le parcours
    </button>
  </div>
</div>

{#if confirmingGpx}
  <ConfirmDialog
    title="Exporter en GPX"
    message={`Veux-tu télécharger « ${item.name} » au format .gpx ?`}
    confirmLabel="Télécharger"
    tone="primary"
    onconfirm={exportGpx}
    oncancel={() => (confirmingGpx = false)}
  />
{/if}

{#if confirming}
  <ConfirmDialog
    title="Supprimer ce parcours ?"
    message={`« ${item.name} » sera supprimé définitivement. Il n'y a pas de retour en arrière.`}
    confirmLabel="Supprimer"
    onconfirm={confirmDelete}
    oncancel={() => (confirming = false)}
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
    width: min(380px, 100%);
    padding: 18px 18px 14px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-title);
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  .close {
    flex: none;
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

  .close:hover {
    background: var(--accent-soft);
  }

  .option {
    position: relative;
    width: 100%;
    min-height: 46px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
  }

  .option:hover:not(:disabled) {
    background: var(--accent-soft);
  }

  .option:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .option.danger {
    color: #c0392b;
  }

  .option.danger:hover:not(:disabled) {
    background: #fbe9e6;
  }

  /* "An update of the offline copy is waiting": a small green dot, like a notification. */
  .dot {
    position: absolute;
    top: 50%;
    right: 14px;
    width: 12px;
    height: 12px;
    margin-top: -6px;
    border: 2px solid var(--panel);
    border-radius: 50%;
    background: #2ea043;
  }

  hr {
    margin: 6px 8px;
    border: none;
    border-top: 1px solid var(--border);
  }
</style>
