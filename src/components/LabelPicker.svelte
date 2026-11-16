<!--
  "+ Label" button and its small menu: pick a label that already exists, or
  create a new one with a name and a colour.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";
  import { library } from "../lib/library.svelte.js";
  import { BASIC_COLORS } from "../lib/parcours";
  import ColorPicker from "./ColorPicker.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let open = $state(false);
  let draft = $state("");
  let color = $state(BASIC_COLORS[3]);
  let root = $state<HTMLDivElement>();
  /** Name of the label the user is about to delete (asks for confirmation). */
  let deleting = $state<string | null>(null);

  /** Existing labels this parcours does not carry yet. */
  const available = $derived(library.labels.filter((l) => !hike.labels.includes(l.name)));

  function pick(name: string): void {
    hike.addLabel(name);
    open = false;
  }

  async function confirmDelete(): Promise<void> {
    const name = deleting;
    deleting = null;
    if (!name) return;
    if (await library.deleteLabel(name)) hike.forgetLabel(name);
    else hike.notify("Le label n'a pas pu être supprimé : lance l'appli avec « npm run dev ».");
  }

  async function create(): Promise<void> {
    const name = draft.trim();
    if (!name) return;
    hike.addLabel(name);
    draft = "";
    open = false;
    if (!(await library.addLabel(name, color))) {
      hike.notify("Le label n'a pas pu être enregistré : lance l'appli avec « npm run dev ».");
    }
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }}
  onkeydown={(event) => {
    if (open && event.key === "Escape") open = false;
  }}
/>

<div class="picker" bind:this={root}>
  <button class="add" type="button" aria-expanded={open} onclick={() => (open = !open)}>+ Label</button>

  {#if open}
    <div class="menu" role="menu">
      {#if available.length > 0}
        <p class="title">Labels existants</p>
        {#each available as label (label.name)}
          <div class="row">
            <button type="button" role="menuitem" class="item" onclick={() => pick(label.name)}>
              <span class="dot" style:background={label.color}></span>{label.name}
            </button>
            <button
              type="button"
              class="trash"
              aria-label="Supprimer le label {label.name}"
              title="Supprimer ce label"
              onclick={() => (deleting = label.name)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </button>
          </div>
        {/each}
      {/if}

      <p class="title">Nouveau label</p>
      <form
        class="new"
        onsubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <input aria-label="Nom du label" placeholder="Nom…" bind:value={draft} />
        <ColorPicker value={color} onpick={(picked) => (color = picked)} />
        <button type="submit" class="create" disabled={!draft.trim()}>Créer et ajouter</button>
      </form>
    </div>
  {/if}
</div>

{#if deleting}
  {@const uses = library.usageCount(deleting)}
  <ConfirmDialog
    title="Supprimer le label « {deleting} » ?"
    message={uses === 0
      ? "Aucun parcours n'utilise ce label."
      : `Il sera retiré ${uses === 1 ? "du parcours" : `des ${uses} parcours`} qui l'utilise${uses === 1 ? "" : "nt"}. Les parcours eux-mêmes ne sont pas supprimés.`}
    confirmLabel="Supprimer"
    oncancel={() => (deleting = null)}
    onconfirm={confirmDelete}
  />
{/if}

<style>
  .picker {
    position: relative;
  }

  .add {
    min-height: 30px;
    padding: 0 12px;
    border: 1px dashed var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
  }

  .add:hover,
  .add[aria-expanded="true"] {
    color: var(--accent);
    border-color: var(--accent);
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 10;
    width: 252px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(31, 42, 36, 0.22);
  }

  /* Phone: the menu is placed against the hike bar, not the button, so it cannot leave the screen. */
  @media (max-width: 720px) {
    .picker {
      position: static;
    }

    .menu {
      left: 10px;
      width: min(252px, calc(100vw - 36px));
    }
  }

  .title {
    margin: 4px 4px 2px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .item {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  .item:hover {
    background: var(--accent-soft);
  }

  .trash {
    flex: none;
    width: 30px;
    height: 30px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .trash:hover {
    background: #fbe9e2;
    color: #c0392b;
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .new {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  input {
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
  }

  .create {
    min-height: 34px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .create:disabled {
    background: #b9bdb6;
    cursor: default;
  }
</style>
