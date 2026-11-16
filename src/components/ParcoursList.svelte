<!--
  The saved parcours, grouped by label. A parcours with several labels is
  listed under each of them. Each line shows its colour, name, type,
  distance, ascent, number of stages (when more than one) and whether it has
  been done. A button above opens the filters.
-->
<script lang="ts">
  import { formatDate, formatDistance, formatMeters } from "../lib/format";
  import { library } from "../lib/library.svelte.js";
  import ParcoursFilters from "./ParcoursFilters.svelte";
  import StageBar from "./StageBar.svelte";
  import TypeIcon from "./TypeIcon.svelte";

  let { onpick, showTitle = true }: { onpick: (id: string) => void; showTitle?: boolean } = $props();

  let filtersOpen = $state(false);
</script>

<div class="list">
  <div class="title-row">
    {#if showTitle}<h2>Mes parcours</h2>{/if}
    {#if library.items.length > 0}
      <button
        type="button"
        class="filter-button"
        class:active={filtersOpen || library.activeFilterCount > 0}
        aria-expanded={filtersOpen}
        aria-label="Filtrer les parcours"
        title="Filtrer"
        onclick={() => (filtersOpen = !filtersOpen)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 4h-7" /><path d="M10 4H3" /><path d="M21 12h-9" /><path d="M8 12H3" /><path d="M21 20h-5" /><path d="M12 20H3" />
          <path d="M14 2v4" /><path d="M8 10v4" /><path d="M16 18v4" />
        </svg>
        {#if library.activeFilterCount > 0}<span class="badge">{library.activeFilterCount}</span>{/if}
      </button>
    {/if}
  </div>

  {#if filtersOpen && library.items.length > 0}
    <ParcoursFilters />
  {/if}

  {#if !library.available}
    <p class="empty">Enregistrement indisponible : lance l'appli avec « npm run dev ».</p>
  {:else if library.items.length === 0}
    <p class="empty">Aucun parcours enregistré pour le moment.</p>
  {:else if library.visibleItems.length === 0}
    <p class="empty">
      Aucun parcours ne correspond aux filtres.
      <button type="button" class="link" onclick={() => library.resetFilters()}>Réinitialiser</button>
    </p>
  {:else}
    {#each library.groups as group (group.key)}
      <details open>
        <summary>
          <span class="dot" style:background={group.color}></span>
          <span class="group-name">{group.name}</span>
          <span class="count">{group.items.length}</span>
          <svg class="chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 5 L7 10 L12 5" />
          </svg>
        </summary>
        <ul>
          {#each group.items as item (item.id)}
            {@const stages = item.stages ?? 1}
            <li>
              <button type="button" class:selected={library.selectedId === item.id} onclick={() => onpick(item.id)}>
                <span class="line" style:background={item.color}></span>
                <span class="text">
                  <b>{item.name}</b>
                  <small>
                    <TypeIcon type={item.type} size={13} />
                    {formatDistance(item.stats.distance)} · D+ {formatMeters(item.stats.ascent)}
                    {#if stages > 1}
                      <span class="stages" title="{stages} étapes">
                        <span class="mini"><StageBar lengths={Array.from({ length: stages }, () => 1)} color={item.color} height={5} /></span>
                        {stages}
                      </span>
                    {/if}
                    {#if item.done}
                      <span class="done">✓ {item.doneOn ? formatDate(item.doneOn) : "Réalisé"}</span>
                      {#if item.rating != null}<span class="stars">★ {item.rating.toLocaleString("fr-FR")}</span>{/if}
                    {/if}
                  </small>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </details>
    {/each}
  {/if}
</div>

<style>
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .filter-button {
    position: relative;
    margin-left: auto;
    width: 30px;
    height: 30px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .filter-button:hover {
    color: var(--accent);
    border-color: var(--border);
  }

  .filter-button.active {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 15px;
    height: 15px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
  }

  .empty {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }

  .link {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }

  details {
    margin-bottom: 6px;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .group-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The number of parcours sits next to the name; the arrow is at the far right. */
  .count {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }

  .chevron {
    flex: none;
    color: var(--muted);
    transition: transform 0.15s ease;
    transform: rotate(-90deg);
  }

  details[open] .chevron {
    transform: rotate(0deg);
  }

  summary:hover .chevron {
    color: var(--accent);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  li button {
    width: 100%;
    display: flex;
    align-items: stretch;
    gap: 10px;
    padding: 6px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  li button:hover {
    background: #fff;
  }

  li button.selected {
    background: var(--accent-soft);
  }

  .line {
    flex: none;
    width: 4px;
    border-radius: 2px;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 600;
  }

  small {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    font-size: 12px;
    color: var(--muted);
  }

  /* Number of stages: a tiny bar cut into stages, and the count. */
  .stages {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    color: var(--text);
  }

  .mini {
    display: inline-block;
    width: 28px;
  }

  .done {
    color: var(--accent);
    font-weight: 600;
  }

  .stars {
    color: #b07a00;
    font-weight: 600;
  }
</style>
