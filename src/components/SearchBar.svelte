<!--
  Search box of the home map: type the name of a summit, a pass, a massif, a GR
  trail or a regional park. Small spelling mistakes are forgiven ("chamechod"
  finds Chamechaude): in each result, the letters that match what was typed are
  in bold, and the mistaken ones stay plain (see search.ts).

  Picking a result highlights it on the map (the rest fades) and zooms on it;
  the cross, or an empty box, puts the map back (see HomeView.svelte).

  The names are downloaded the first time the box is used.

  With a home address in the profile, each result also gets the time by car
  (see drive.ts). It is only worked out for the few results on screen, once the
  person has stopped typing for a moment, never for everything that matches.
  A trail gets none (it is a route, not a place).
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { auth } from "../lib/auth.svelte.js";
  import { driveBetween, formatDuration } from "../lib/drive";
  import { explore } from "../lib/explore.svelte.js";
  import { connection } from "../lib/online.svelte.js";
  import { CAR_MARKUP } from "../lib/parcoursCard";
  import { loadSearchIndex, searchPlaces, type PlaceEntry, type PlaceKind } from "../lib/searchIndex";

  let query = $state(explore.highlight?.title ?? "");
  let focused = $state(false);
  let index = $state.raw<PlaceEntry[] | null>(null);
  let failed = $state(false);
  let active = $state(0);
  let field: HTMLInputElement;

  const KIND_LABEL: Record<PlaceKind, string> = { peak: "▲", gr: "GR", massif: "◭", park: "▦" };

  const results = $derived(index && query.trim().length >= 2 ? searchPlaces(index, query) : []);
  const showList = $derived(focused && query.trim().length >= 2);

  /** Time by car of the results already worked out, by result. */
  let times = $state<Record<string, string>>({});
  const keyOf = (entry: PlaceEntry): string => `${entry.kind}|${entry.title}|${entry.center?.join(",")}`;

  // Work out the time by car of the results on screen, a short moment after the last key typed.
  $effect(() => {
    const home = auth.home;
    const shown = showList ? results.map((match) => match.entry) : [];
    if (!home || !connection.online || shown.length === 0) return;
    const timer = setTimeout(() => {
      for (const entry of shown) {
        const key = keyOf(entry);
        if (!entry.center || untrack(() => times[key])) continue;
        driveBetween([home.lon, home.lat], entry.center).then((answer) => {
          if (answer) times = { ...times, [key]: formatDuration(answer.minutes) };
        });
      }
    }, 450);
    return () => clearTimeout(timer);
  });

  function prepareIndex(): void {
    if (index || failed) return;
    loadSearchIndex().then(
      (loaded) => (index = loaded),
      () => (failed = true),
    );
  }

  function pick(entry: PlaceEntry): void {
    query = entry.title;
    explore.highlight = entry;
    focused = false;
    field.blur();
  }

  function clear(): void {
    query = "";
    explore.highlight = null;
    active = 0;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      active = (active + 1) % results.length;
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      active = (active - 1 + results.length) % results.length;
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      pick(results[active].entry);
    } else if (event.key === "Escape") {
      if (focused) {
        focused = false;
        field.blur();
      } else if (explore.highlight) clear();
    }
  }
</script>

<div class="search" role="search">
  <div class="box" class:has-text={query !== ""}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" />
    </svg>
    <input
      bind:this={field}
      type="search"
      placeholder="Sommet, massif, GR…"
      aria-label="Rechercher un sommet, un massif ou un sentier"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      bind:value={query}
      onfocus={() => {
        focused = true;
        prepareIndex();
      }}
      onblur={() => (focused = false)}
      oninput={() => {
        active = 0;
        focused = true;
        if (query === "") explore.highlight = null;
      }}
      onkeydown={onKeydown}
    />
    {#if query !== ""}
      <button type="button" class="clear" aria-label="Effacer la recherche" onmousedown={(event) => event.preventDefault()} onclick={clear}>×</button>
    {/if}
  </div>

  {#if showList}
    <ul class="results" role="listbox" aria-label="Résultats" onmousedown={(event) => event.preventDefault()}>
      {#if failed}
        <li class="note">La recherche n'a pas pu se charger. Réessaie dans un instant.</li>
      {:else if !index}
        <li class="note">Chargement des noms…</li>
      {:else if results.length === 0}
        <li class="note">Aucun résultat pour « {query.trim()} ».</li>
      {:else}
        {#each results as { entry, pieces }, i (entry.kind + entry.title + entry.subtitle + i)}
          <li role="option" aria-selected={i === active}>
            <button type="button" class:active={i === active} onclick={() => pick(entry)} onmouseenter={() => (active = i)}>
              <span class="kind kind-{entry.kind}" aria-hidden="true">{KIND_LABEL[entry.kind]}</span>
              <span class="text">
                <span class="title">{#each pieces as piece}{#if piece.bold}<b>{piece.text}</b>{:else}{piece.text}{/if}{/each}</span>
                <small>
                  {entry.subtitle}
                  {#if times[keyOf(entry)]}
                    <span class="drive" title="Jusqu'à la route la plus proche, depuis ton domicile, sans circulation">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html CAR_MARKUP}</svg>
                      ≈ {times[keyOf(entry)]}
                    </span>
                  {/if}
                </small>
              </span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: absolute;
    top: 10px;
    left: 12px;
    z-index: 4; /* under the account button (5), whose windows (profile...) must cover it */
    width: min(360px, calc(100% - 150px));
  }

  .box {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 6px 0 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(31, 42, 36, 0.18);
    color: var(--muted);
  }

  .box:focus-within {
    border-color: var(--accent);
    box-shadow: 0 2px 12px rgba(31, 42, 36, 0.25);
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 16px; /* 16 px: a phone does not zoom the page when the box is touched */
  }

  input::placeholder {
    color: var(--muted);
  }

  /* The browser's own cross is replaced by ours. */
  input::-webkit-search-cancel-button {
    display: none;
  }

  .clear {
    flex: none;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  .clear:hover {
    background: var(--accent-soft);
  }

  .results {
    margin: 6px 0 0;
    padding: 4px;
    max-height: min(60vh, 420px);
    overflow-y: auto;
    list-style: none;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(31, 42, 36, 0.28);
  }

  .note {
    padding: 10px 12px;
    font-size: 13px;
    color: var(--muted);
  }

  .results button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .results button.active {
    background: var(--accent-soft);
  }

  .kind {
    flex: none;
    width: 30px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: #eef1ee;
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
  }

  .kind-gr {
    background: #fbe7e8;
    color: #c0262d;
  }

  .kind-massif {
    background: #f6ead9;
    color: #8a4f17;
  }

  .kind-park {
    background: #e3f1e5;
    color: #2c6a35;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title {
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .title b {
    font-weight: 800;
    color: #000;
  }

  .text small {
    font-size: 12px;
    color: var(--muted);
  }

  .drive {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
    font-weight: 600;
    color: var(--accent);
  }

  /* Phone: under the band of the app, left of the compass and the account button. */
  @media (max-width: 720px) {
    .search {
      top: 62px;
      left: 8px;
      width: auto;
      right: 108px;
    }
  }
</style>
