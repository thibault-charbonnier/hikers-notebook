<!--
  Form shown in a bubble when a point of interest is clicked: its type (which
  sets the icon), a name, a short description, and a delete button.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";
  import { POI_TYPES, pinInfo } from "../lib/poi";
  import PoiIcon from "./PoiIcon.svelte";

  let { poiId, onclose }: { poiId: string; onclose: () => void } = $props();

  const poi = $derived(hike.pois.find((p) => p.id === poiId));
</script>

{#if poi}
  <form onsubmit={(e) => { e.preventDefault(); onclose(); }}>
    <div class="types" role="radiogroup" aria-label="Type de point d'intérêt">
      {#each POI_TYPES as info (info.id)}
        <button
          type="button"
          role="radio"
          aria-checked={poi.type === info.id}
          aria-label={info.label}
          title={info.label}
          class:active={poi.type === info.id}
          style:--pin-color={info.color}
          onclick={() => hike.setPoiType(poiId, info.id)}
        >
          <PoiIcon type={info.id} size={16} />
        </button>
      {/each}
    </div>
    <input
      class="name"
      aria-label="Nom du point d'intérêt"
      placeholder="{pinInfo(poi.type).label}…"
      value={poi.name}
      oninput={(e) => (poi.name = e.currentTarget.value)}
    />
    <textarea
      rows="2"
      aria-label="Description du point d'intérêt"
      placeholder="Description…"
      value={poi.description}
      oninput={(e) => (poi.description = e.currentTarget.value)}
    ></textarea>
    <div class="actions">
      <button type="button" class="danger" onclick={() => { hike.removePoi(poiId); onclose(); }}>Supprimer</button>
      <button type="submit" class="ok">OK</button>
    </div>
  </form>
{/if}

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: var(--font-body);
    color: var(--text);
  }

  .types {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .types button {
    width: 30px;
    height: 30px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    border-radius: 50%;
    background: transparent;
    color: var(--pin-color);
    cursor: pointer;
  }

  .types button:hover {
    background: var(--bg);
  }

  .types button.active {
    background: #fff;
    border-color: var(--pin-color);
  }

  input,
  textarea {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
  }

  textarea {
    resize: vertical;
  }

  .actions {
    display: flex;
    justify-content: space-between;
  }

  .actions button {
    min-height: 32px;
    padding: 0 14px;
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .ok {
    border: none;
    background: var(--accent);
    color: #fff;
  }

  .danger {
    border: 1px solid #d9b3a6;
    background: #fff;
    color: #8c3a1b;
  }
</style>
