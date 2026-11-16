<!--
  Form shown in a bubble when a point is clicked: its number in the order,
  a name, a short description, and a delete button.
  Changing the number moves the point in the order (the others renumber).
  The ends of a loop keep their place, so their number cannot be changed.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";

  let { pointId, onclose }: { pointId: string; onclose: () => void } = $props();

  const point = $derived(hike.points.find((p) => p.id === pointId));
  const number = $derived(hike.points.findIndex((p) => p.id === pointId) + 1);
  const isLoopEnd = $derived(hike.closed && number === 1);
  /** Only a point between the first and the last one can end a stage. */
  const canBeStage = $derived(number > 1 && number < hike.points.length);
</script>

{#if point}
  <form onsubmit={(e) => { e.preventDefault(); onclose(); }}>
    <div class="row">
      <label>
        N°
        <input
          type="number"
          min={hike.closed ? 2 : 1}
          max={hike.closed ? hike.points.length - 1 : hike.points.length}
          value={number}
          disabled={isLoopEnd}
          onchange={(e) => hike.renumber(pointId, Number(e.currentTarget.value))}
        />
      </label>
      <input
        class="name"
        aria-label="Nom du point de passage"
        placeholder="Nom…"
        value={point.name}
        oninput={(e) => (point.name = e.currentTarget.value)}
      />
    </div>
    <textarea
      rows="2"
      aria-label="Description du point de passage"
      placeholder="Description…"
      value={point.description}
      oninput={(e) => (point.description = e.currentTarget.value)}
    ></textarea>
    {#if canBeStage}
      <label class="stage">
        <input type="checkbox" checked={point.stage} onchange={() => hike.toggleStage(pointId)} />
        Fin d'étape
      </label>
    {/if}
    <div class="actions">
      <button type="button" class="danger" onclick={() => { hike.removePoint(pointId); onclose(); }}>
        Supprimer
      </button>
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

  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }

  input,
  textarea {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
  }

  .stage {
    gap: 8px;
    color: var(--text);
  }

  .stage input {
    width: 16px;
    height: 16px;
    padding: 0;
    accent-color: var(--accent);
  }

  input[type="number"] {
    width: 56px;
  }

  input:disabled {
    background: var(--bg);
    color: var(--muted);
  }

  .name {
    flex: 1;
    min-width: 0;
  }

  textarea {
    resize: vertical;
  }

  .actions {
    display: flex;
    justify-content: space-between;
  }

  button {
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
