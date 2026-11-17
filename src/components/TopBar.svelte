<!--
  Floating card at the top of the planning map: colour, name and type of the
  parcours, its labels, and a "Détails" section (description, done or not,
  date, rating and comment). Also holds the save button.

  On a phone the type switch (walk, hike, trek) moves into the details, to
  keep the card short. The description grows with its text (up to 10 lines),
  and so does the comment on how the hike went (up to 5 lines).
-->
<script lang="ts">
  import { saveHike } from "../lib/actions";
  import { hike } from "../lib/hike.svelte.js";
  import { library } from "../lib/library.svelte.js";
  import { connection } from "../lib/online.svelte.js";
  import { PARCOURS_TYPES } from "../lib/parcours";
  import { autosize } from "../lib/autosize";
  import { ui } from "../lib/ui.svelte.js";
  import { viewport } from "../lib/viewport.svelte.js";
  import ColorPicker from "./ColorPicker.svelte";
  import LabelPicker from "./LabelPicker.svelte";
  import StarRating from "./StarRating.svelte";
  import TypeIcon from "./TypeIcon.svelte";

  let detailsOpen = $state(false);
  let colorOpen = $state(false);
  let saving = $state(false);
  let colorRoot = $state<HTMLDivElement>();
  let nameField = $state<HTMLTextAreaElement>();
  let bar = $state<HTMLDivElement>();

  // Tell the rest of the page whether the details are open (on a phone the floating buttons hide then).
  $effect(() => {
    ui.detailsOpen = detailsOpen;
    return () => (ui.detailsOpen = false);
  });

  // Tell the rest of the page where this bar ends, so the tool palette can sit
  // right under it on a phone (the bar grows with a long name or open details).
  $effect(() => {
    const element = bar;
    if (!element) return;
    const report = () => (ui.topBarBottom = element.offsetTop + element.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  });

  const canSave = $derived(hike.points.length >= 2 && !hike.loading && hike.dirty && !saving && connection.online);
  const status = $derived(hike.dirty ? "Modifications non enregistrées" : hike.isSaved ? "✓ Enregistré" : "");

  /** Make the name field as tall as its text: one line, or two when the name is long. */
  function fitName(): void {
    if (!nameField) return;
    nameField.style.height = "auto";
    nameField.style.height = `${nameField.scrollHeight}px`;
  }

  // Refit when the name changes, and when the bar changes width (the text wraps differently).
  $effect(() => {
    const field = nameField;
    if (!field) return;
    void hike.name;
    fitName();
    const observer = new ResizeObserver(fitName);
    observer.observe(field);
    return () => observer.disconnect();
  });

  async function save(): Promise<void> {
    saving = true;
    await saveHike();
    saving = false;
  }

  /** Ticking "done" proposes today's date. */
  function onDoneChange(): void {
    if (hike.done && !hike.doneOn) hike.doneOn = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (colorOpen && colorRoot && !colorRoot.contains(event.target as Node)) colorOpen = false;
  }}
  onkeydown={(event) => {
    if (colorOpen && event.key === "Escape") colorOpen = false;
  }}
/>

{#snippet typeToggle()}
    <div class="types" role="radiogroup" aria-label="Type de parcours">
      {#each PARCOURS_TYPES as info (info.id)}
        <button
          type="button"
          role="radio"
          aria-checked={hike.type === info.id}
          class:active={hike.type === info.id}
          onclick={() => (hike.type = info.id)}
        >
          <TypeIcon type={info.id} />
          <span>{info.label}</span>
        </button>
      {/each}
    </div>
{/snippet}

<div class="bar" bind:this={bar}>
  <div class="row">
    <a class="back" href="#/" aria-label="Retour à la vue générale" title="Vue générale">
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2 L4 7 L9 12" /></svg>
    </a>
    <div class="color" bind:this={colorRoot}>
      <button
        type="button"
        class="swatch"
        aria-label="Changer la couleur du parcours"
        aria-expanded={colorOpen}
        title="Couleur du parcours"
        style:background={hike.routeColor}
        onclick={() => (colorOpen = !colorOpen)}
      ></button>
      {#if colorOpen}
        <div class="color-menu">
          <p>Couleur du parcours</p>
          <ColorPicker value={hike.routeColor} onpick={(color) => (hike.color = color)} />
        </div>
      {/if}
    </div>

    <!-- A text area, so a long name goes on a second line; Enter validates instead of adding a line. -->
    <textarea
      class="name"
      rows="1"
      aria-label="Nom du parcours"
      placeholder="Nom du parcours"
      bind:this={nameField}
      bind:value={hike.name}
      onkeydown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    ></textarea>

    {#if !viewport.phone}
      {@render typeToggle()}
    {/if}

    <button type="button" class="save" disabled={!canSave} onclick={save}>
      {saving ? "Enregistrement…" : "Enregistrer"}
    </button>
  </div>

  <div class="row">
    <ul class="labels">
      {#each hike.labels as name (name)}
        <li>
          <span class="dot" style:background={library.labelColor(name)}></span>
          {name}
          <button type="button" aria-label="Retirer le label {name}" onclick={() => hike.removeLabel(name)}>×</button>
        </li>
      {/each}
    </ul>
    <LabelPicker />
    <span class="status" class:unsaved={hike.dirty} class:saved={!hike.dirty && hike.isSaved}>{status}</span>
    <button type="button" class="toggle" aria-expanded={detailsOpen} onclick={() => (detailsOpen = !detailsOpen)}>
      Détails
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
           style:transform={detailsOpen ? "rotate(180deg)" : "none"}>
        <path d="M2 5 L7 10 L12 5" />
      </svg>
    </button>
  </div>

  {#if detailsOpen}
    <div class="details">
      {#if viewport.phone}
        {@render typeToggle()}
      {/if}
      <textarea
        rows="2"
        aria-label="Description du parcours"
        placeholder="Description…"
        bind:value={hike.description}
        use:autosize={{ value: hike.description, maxLines: 10 }}
      ></textarea>

      <label class="done">
        <input type="checkbox" bind:checked={hike.done} onchange={onDoneChange} />
        Réalisé
      </label>
      {#if hike.done}
        <div class="done-details">
          <div class="done-line">
            <input
              type="date"
              aria-label="Date de réalisation"
              value={hike.doneOn ?? ""}
              oninput={(event) => (hike.doneOn = event.currentTarget.value || null)}
            />
            <StarRating value={hike.rating} onchange={(rating) => (hike.rating = rating)} />
          </div>
          <textarea
            rows="2"
            aria-label="Commentaire sur la réalisation"
            placeholder="Comment ça s'est passé…"
            bind:value={hike.doneComment}
            use:autosize={{ value: hike.doneComment, maxLines: 5 }}
          ></textarea>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .bar {
    position: absolute;
    top: 16px;
    left: 0;
    right: 0;
    z-index: 4;
    margin: 0 auto;
    width: min(780px, calc(100% - 220px));
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(31, 42, 36, 0.18);
  }

  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  /* Back to the overview: only on a phone, where the side menu is not there. */
  .back {
    display: none;
    flex: none;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: var(--bg);
    color: var(--text);
  }

  .color {
    position: relative;
    flex: none;
  }

  .swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border);
    cursor: pointer;
  }

  .swatch:hover,
  .swatch[aria-expanded="true"] {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .color-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: -6px;
    z-index: 10;
    width: 244px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(31, 42, 36, 0.22);
  }

  .color-menu p {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .name {
    flex: 1;
    min-width: 140px;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-family: var(--font-title);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
    resize: none;
    overflow: hidden;
  }

  .name:hover,
  .name:focus {
    border-color: var(--border);
    background: #fff;
    outline: none;
  }

  /* Type of parcours: the name is always visible, not only on hover. */
  .types {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--bg);
    border-radius: 12px;
  }

  .types button {
    width: 78px;
    padding: 5px 0 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .types button:hover {
    color: var(--accent);
  }

  .types button.active {
    background: #fff;
    color: var(--accent);
    box-shadow: 0 1px 3px rgba(31, 42, 36, 0.2);
  }

  .save {
    min-height: 38px;
    padding: 0 16px;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .save:disabled {
    background: #b9bdb6;
    cursor: default;
  }

  .labels {
    display: contents;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .labels li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px 4px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: #fff;
    font-size: 13px;
    font-weight: 500;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .labels li button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .labels li button:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  .status {
    margin-left: auto;
    font-size: 12px;
    color: var(--muted);
  }

  .status.unsaved {
    color: #8c3a1b;
  }

  .status.saved {
    color: var(--accent);
    font-weight: 600;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .toggle:hover {
    color: var(--accent);
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }

  textarea,
  input[type="date"] {
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font: inherit;
    font-size: 14px;
  }

  /* These fields grow with their text (see autosize.ts): no handle, and a set line height to count lines. */
  textarea {
    resize: none;
    line-height: 1.4;
  }

  .done {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .done input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .done-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-left: 26px;
  }

  .done-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  /* Phone: the bar spans the top of the screen; the types go on their own line. */
  @media (max-width: 720px) {
    .bar {
      top: 8px;
      left: 8px;
      right: 8px;
      width: auto;
      margin: 0;
      padding: 8px 10px;
      gap: 6px;
    }

    .back {
      display: flex;
    }

    .row {
      gap: 6px 8px;
      flex-wrap: wrap;
    }

    .name {
      min-width: 0;
      font-size: 18px;
      max-height: 3.6em; /* two lines at most, plus the padding */
    }

    .types {
      order: 3;
      flex-basis: 100%;
    }

    /* Inside the details, the type switch comes first. */
    .details .types {
      order: -1;
    }

    .types button {
      flex: 1;
      width: auto;
      flex-direction: row;
      justify-content: center;
      gap: 6px;
      padding: 6px 0;
      font-size: 12px;
    }

    .save {
      min-height: 34px;
      padding: 0 12px;
    }

    .status {
      font-size: 11px;
    }

    .color-menu {
      width: min(244px, calc(100vw - 40px));
    }
  }
</style>
