<!--
  Floating tool palette on the map: move the map (hand), place points
  (target), undo and redo. Right-clicking the map always places a point,
  whatever the tool.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";
  import { COMMENT, POI_TYPES, type PinType } from "../lib/poi";
  import PoiIcon from "./PoiIcon.svelte";

  let menuOpen = $state(false);

  /**
   * Choose what the next click on the map places. The menu stays open (so the
   * user can move the map and come back to it); only its button closes it.
   */
  function chooseToPlace(type: PinType): void {
    hike.poiToPlace = type;
    hike.tool = "poi";
  }
</script>

<div class="tools" role="toolbar" aria-label="Outils de la carte">
  <button
    type="button"
    class:active={hike.tool === "move"}
    aria-label="Se déplacer sur la carte"
    aria-pressed={hike.tool === "move"}
    title="Se déplacer (Échap)"
    onclick={() => (hike.tool = "move")}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  </button>
  <button
    type="button"
    class:active={hike.tool === "add"}
    aria-label="Placer des points de passage"
    aria-pressed={hike.tool === "add"}
    title="Placer des points de passage"
    onclick={() => (hike.tool = "add")}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  </button>

  <div class="poi-wrap">
    <button
      type="button"
      class:active={hike.tool === "poi"}
      class:open={menuOpen}
      aria-label="Ajouter un point d'intérêt"
      aria-expanded={menuOpen}
      title="Point d'intérêt"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <path d="M12 6.5v7" /><path d="M8.5 10h7" />
      </svg>
    </button>

    {#if menuOpen}
      <div class="flyout" role="menu">
        <p>Points d'intérêt</p>
        <div class="grid">
          {#each POI_TYPES as info (info.id)}
            <button
              type="button"
              role="menuitem"
              class="choice"
              class:selected={hike.tool === "poi" && hike.poiToPlace === info.id}
              onclick={() => chooseToPlace(info.id)}
            >
              <span class="badge" style:--pin-color={info.color}><PoiIcon type={info.id} size={16} /></span>
              {info.label}
            </button>
          {/each}
        </div>
        <p>Note</p>
        <button
          type="button"
          role="menuitem"
          class="choice"
          class:selected={hike.tool === "poi" && hike.poiToPlace === "comment"}
          onclick={() => chooseToPlace("comment")}
        >
          <span class="badge" style:--pin-color={COMMENT.color}><PoiIcon type="comment" size={16} /></span>
          {COMMENT.label}
        </button>
      </div>
    {/if}
  </div>

  <hr />

  <button
    type="button"
    aria-label="Annuler"
    title="Annuler (Ctrl+Z)"
    disabled={hike.undoCount === 0}
    onclick={() => hike.undo()}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  </button>
  <button
    type="button"
    aria-label="Rétablir"
    title="Rétablir (Ctrl+Y)"
    disabled={hike.redoCount === 0}
    onclick={() => hike.redo()}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
  </button>
</div>

<style>
  .tools {
    position: absolute;
    top: 16px;
    left: 16px;
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

  .poi-wrap {
    position: relative;
  }

  .flyout {
    position: absolute;
    top: 0;
    left: calc(100% + 14px);
    width: 272px;
    padding: 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 6px 20px rgba(31, 42, 36, 0.22);
  }

  .flyout p {
    margin: 4px 4px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    margin-bottom: 8px;
  }

  .flyout .choice {
    width: auto;
    height: auto;
    min-height: 40px;
    padding: 4px 8px;
    justify-content: flex-start;
    gap: 8px;
    font: inherit;
    font-size: 13px;
    text-align: left;
  }

  .badge {
    flex: none;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--pin-color);
    color: var(--pin-color);
  }

  hr {
    width: 28px;
    margin: 2px auto;
    border: none;
    border-top: 1px solid var(--border);
  }

  button {
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

  button.active {
    background: var(--accent);
    color: #fff;
  }

  /* Menu open but nothing chosen yet. */
  button.open:not(.active) {
    background: var(--accent-soft);
    color: var(--accent);
  }

  /* The pin the next click will place. */
  .flyout .choice.selected {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  /* Phone: bottom left, above the map scale and the closed sheet; the menu opens upwards. */
  @media (max-width: 720px) {
    .tools {
      top: auto;
      bottom: 104px;
      left: 8px;
    }

    .flyout {
      top: auto;
      bottom: 0;
      width: min(272px, calc(100vw - 90px));
    }
  }
</style>
