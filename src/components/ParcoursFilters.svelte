<!--
  Filters of the parcours list (and of the overview map): by type, by label,
  by distance and by number of stages. Several types or labels can be picked:
  a parcours is kept if it matches any of them.
-->
<script lang="ts">
  import { library } from "../lib/library.svelte.js";
  import { PARCOURS_TYPES } from "../lib/parcours";
  import type { ParcoursType } from "../lib/parcours";
  import RangeSlider from "./RangeSlider.svelte";
  import TypeIcon from "./TypeIcon.svelte";

  const filters = $derived(library.filters);
  const km = $derived(filters.km ?? [0, library.maxKm]);
  const stages = $derived(filters.stages ?? [1, library.maxStages]);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  /** A range that covers everything is the same as no filter. */
  function setKm(low: number, high: number): void {
    library.filters.km = low <= 0 && high >= library.maxKm ? null : [low, high];
  }

  function setStages(low: number, high: number): void {
    library.filters.stages = low <= 1 && high >= library.maxStages ? null : [low, high];
  }
</script>

<div class="filters">
  <section>
    <h3>Type</h3>
    <div class="chips">
      {#each PARCOURS_TYPES as info (info.id)}
        <button
          type="button"
          class="chip"
          class:active={filters.types.includes(info.id)}
          aria-pressed={filters.types.includes(info.id)}
          onclick={() => (library.filters.types = toggle<ParcoursType>(filters.types, info.id))}
        >
          <TypeIcon type={info.id} size={14} />
          {info.label}
        </button>
      {/each}
    </div>
  </section>

  {#if library.labels.length > 0}
    <section>
      <h3>Labels</h3>
      <div class="chips">
        {#each library.labels as label (label.name)}
          <button
            type="button"
            class="chip"
            class:active={filters.labels.includes(label.name)}
            aria-pressed={filters.labels.includes(label.name)}
            onclick={() => (library.filters.labels = toggle(filters.labels, label.name))}
          >
            <span class="dot" style:background={label.color}></span>
            {label.name}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <h3>
      Kilomètres
      <span class="value">{km[0]} – {km[1]} km</span>
    </h3>
    <RangeSlider min={0} max={library.maxKm} low={km[0]} high={km[1]} label="Kilomètres" onchange={setKm} />
  </section>

  {#if library.maxStages > 1}
    <section>
      <h3>
        Étapes
        <span class="value">{stages[0]} – {stages[1]}</span>
      </h3>
      <RangeSlider min={1} max={library.maxStages} low={stages[0]} high={stages[1]} label="Étapes" onchange={setStages} />
    </section>
  {/if}

  {#if library.activeFilterCount > 0}
    <button type="button" class="reset" onclick={() => library.resetFilters()}>Réinitialiser les filtres</button>
  {/if}
</div>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;
    padding: 14px;
    background: #fff;
    border: 1px solid #e5dfce;
    border-radius: 14px;
  }

  h3 {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .value {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: var(--accent);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .chip:hover {
    border-color: var(--accent);
  }

  .chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px #fff;
  }

  .reset {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
