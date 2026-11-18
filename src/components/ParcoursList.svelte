<!--
  The saved parcours, grouped by label. A parcours with several labels is
  listed under each of them. Each line shows its colour, name, type,
  distance, ascent, number of stages (when more than one) and whether it has
  been done. A button above opens the filters; a cog at the right of each
  parcours opens its options (see ParcoursOptionsDialog.svelte).

  Below, under a dashed line, the "Parcours partagés": the parcours received
  through a share link (see sharing.ts), by name, with the first name of the
  person who shared them.
-->
<script lang="ts">
  import { formatDate, formatDistance, formatMeters } from "../lib/format";
  import { library } from "../lib/library.svelte.js";
  import { offline } from "../lib/offline.svelte.js";
  import { connection } from "../lib/online.svelte.js";
  import type { ParcoursSummary } from "../lib/parcours";
  import ParcoursFilters from "./ParcoursFilters.svelte";
  import StageBar from "./StageBar.svelte";
  import TypeIcon from "./TypeIcon.svelte";

  let { onpick, showTitle = true }: { onpick: (id: string) => void; showTitle?: boolean } = $props();

  let filtersOpen = $state(false);
</script>

{#snippet row(item: ParcoursSummary)}
    {@const stages = item.stages ?? 1}
    <li>
      <button type="button" class="pick" class:selected={library.selectedId === item.id} onclick={() => onpick(item.id)}>
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
            {#if item.sharedBy}<span class="by">de {item.sharedBy}</span>{/if}
          {#if connection.online && offline.has(item.id)}
              <span class="saved" title="Disponible hors réseau">⇩ hors réseau</span>
            {/if}
            {#if item.done}
              <span class="done">✓ {item.doneOn ? formatDate(item.doneOn) : "Réalisé"}</span>
              {#if item.rating != null}<span class="stars">★ {item.rating.toLocaleString("fr-FR")}</span>{/if}
            {/if}
          </small>
        </span>
      </button>
      <button
        type="button"
        class="gear"
        aria-label="Options de {item.name}"
        title="Options"
        onclick={() => (library.optionsFor = item)}
      >
        {#if offline.needsUpdate(item.id)}<span class="dot" role="img" aria-label="Mise à jour disponible"></span>{/if}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </li>
{/snippet}

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
    <p class="empty">Impossible de charger tes parcours : vérifie ta connexion à internet.</p>
  {:else if library.items.length === 0}
    <p class="empty">
      {connection.online
        ? "Aucun parcours enregistré pour le moment."
        : "Aucun parcours téléchargé sur cet appareil. Télécharge-en depuis la liste quand tu as du réseau."}
    </p>
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
            {@render row(item)}
          {/each}
        </ul>
      </details>
    {/each}

    {#if library.sharedItems.length > 0}
      <section class="shared" aria-label="Parcours partagés">
        <h3>Parcours partagés</h3>
        <ul>
          {#each library.sharedItems as item (item.id)}
            {@render row(item)}
          {/each}
        </ul>
      </section>
    {/if}
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

  li {
    display: flex;
    align-items: stretch;
    gap: 2px;
  }

  .pick {
    flex: 1;
    min-width: 0;
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

  .pick:hover {
    background: #fff;
  }

  .pick.selected {
    background: var(--accent-soft);
  }

  /* The cog at the right of a parcours: its options window. */
  .gear {
    position: relative;
    flex: none;
    align-self: center;
    width: 34px;
    height: 34px;
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

  /* "An update of the offline copy is waiting": a small green dot, like a notification. */
  .dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 10px;
    height: 10px;
    border: 2px solid var(--panel);
    border-radius: 50%;
    background: #2ea043;
  }

  .gear:hover {
    background: #fff;
    color: var(--accent);
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

  .by {
    color: var(--muted);
    font-style: italic;
  }

  /* The parcours received through a link: set apart under a dashed line. */
  .shared {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 2px dashed var(--border);
  }

  .shared h3 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .done,
  .saved {
    color: var(--accent);
    font-weight: 600;
  }

  .stars {
    color: #b07a00;
    font-weight: 600;
  }
</style>
